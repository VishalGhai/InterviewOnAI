import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ─── Tier → amount mapping (paise) for server-side validation ─── */
const TIER_AMOUNTS: Record<string, number> = {
    "5": 4900,
    "10": 9900,
    "15": 14900,
    "20": 19900,
};

/* ─── CORS helpers ─── */
const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

function randomCode(prefix = "ERR"): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let suffix = "";
    for (let i = 0; i < 6; i++) {
        suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${prefix}${suffix}`;
}

function errorResponse(internalCode: string, status = 500, details?: unknown) {
    const publicCode = randomCode("SRV");
    console.error("[EDGE_ERROR]", { internalCode, publicCode, details });
    return jsonResponse({
        error: `Sorry, we will back soon (${publicCode})`,
        code: publicCode,
    }, status);
}

/* ─── HMAC-SHA256 verification ─── */
async function hmacSha256(key: string, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(key),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/* ─── Supabase admin client (service role — bypasses RLS) ─── */
function getAdminClient() {
    return createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
}

/* ─── Extract authenticated user from JWT ─── */
async function getUser(authHeader: string | null) {
    if (!authHeader) return null;
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
}

/* ─── Action: create-order ─── */
async function createOrder(userId: string, tier: string, amount: number) {
    // Server-side validation: amount must match tier
    const expectedAmount = TIER_AMOUNTS[tier];
    if (!expectedAmount || expectedAmount !== amount) {
        return errorResponse("EDGE-ORDER-VALIDATION-001", 400, { tier, amount, expectedAmount });
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
        return errorResponse("EDGE-ORDER-CONFIG-001", 500);
    }

    // Create Razorpay order
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
        },
        body: JSON.stringify({
            amount,
            currency: "INR",
            receipt: `tier_${tier}_${Date.now()}`,
        }),
    });

    if (!rzpRes.ok) {
        const err = await rzpRes.text();
        return errorResponse("EDGE-ORDER-RAZORPAY-001", 502, err);
    }

    const order = await rzpRes.json();

    // Record in payments table
    const admin = getAdminClient();
    const { data, error } = await admin
        .from("payments")
        .insert({
            user_id: userId,
            razorpay_order_id: order.id,
            amount,
            tier,
            status: "created",
        })
        .select("id")
        .single();

    if (error) {
        return errorResponse("EDGE-ORDER-DB-001", 500, error);
    }

    return jsonResponse({ order_id: order.id, payment_id: data.id });
}

/* ─── Action: verify-payment ─── */
async function verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    paymentId: string,
) {
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keySecret) {
        return errorResponse("EDGE-VERIFY-CONFIG-001", 500);
    }

    // HMAC SHA256 verification
    const expectedSig = await hmacSha256(
        keySecret,
        `${razorpayOrderId}|${razorpayPaymentId}`,
    );

    if (expectedSig !== razorpaySignature) {
        // Mark payment as failed
        const admin = getAdminClient();
        await admin
            .from("payments")
            .update({ status: "failed" })
            .eq("id", paymentId);

        return errorResponse("EDGE-VERIFY-SIGNATURE-001", 400, { paymentId, razorpayOrderId });
    }

    // Update payment record
    const admin = getAdminClient();
    const { error } = await admin
        .from("payments")
        .update({
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: razorpaySignature,
            status: "paid",
            paid_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

    if (error) {
        return errorResponse("EDGE-VERIFY-DB-001", 500, error);
    }

    return jsonResponse({ verified: true });
}

/* ─── Main handler ─── */
Deno.serve(async (req: Request) => {
    try {
        if (req.method === "OPTIONS") {
            return new Response("ok", { headers: CORS_HEADERS });
        }

        if (req.method !== "POST") {
            return errorResponse("EDGE-METHOD-001", 405, { method: req.method });
        }

        const user = await getUser(req.headers.get("authorization"));
        if (!user) {
            return errorResponse("EDGE-AUTH-001", 401);
        }

        const body = await req.json();
        const { action } = body;

        switch (action) {
            case "create-order":
                return createOrder(user.id, body.tier, body.amount);

            case "verify-payment":
                return verifyPayment(
                    body.razorpay_order_id,
                    body.razorpay_payment_id,
                    body.razorpay_signature,
                    body.payment_id,
                );

            default:
                return errorResponse("EDGE-ACTION-001", 400, { action });
        }
    } catch (error) {
        return errorResponse("EDGE-UNHANDLED-001", 500, error);
    }
});
