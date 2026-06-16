/* Database Service — all Supabase DB operations */

function dbCapture(error, internalCode, context, extra) {
    return ErrorHandler.capture(error, {
        internalCode,
        context,
        extra,
        publicPrefix: 'DB'
    });
}

function dbThrow(error, internalCode, context, extra) {
    const details = dbCapture(error, internalCode, context, extra);
    const wrapped = new Error(`${internalCode}:${details.publicCode}`);
    wrapped.internalCode = internalCode;
    wrapped.publicCode = details.publicCode;
    throw wrapped;
}

const DatabaseService = {

    // ─── Profile ────────────────────────────────────────────

    async getProfile() {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) {
                dbCapture(error, 'DB-PROFILE-GET-001', 'DatabaseService.getProfile.query');
                return null;
            }
            return data;
        } catch (error) {
            dbCapture(error, 'DB-PROFILE-GET-002', 'DatabaseService.getProfile');
            return null;
        }
    },

    async isFreeTierExhausted() {
        try {
            const profile = await this.getProfile();
            return profile ? profile.is_free_tier_exhausted : false;
        } catch (error) {
            dbCapture(error, 'DB-FREE-TIER-READ-001', 'DatabaseService.isFreeTierExhausted');
            return false;
        }
    },

    async markFreeTierExhausted() {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return;

            const { error } = await supabaseClient
                .from('profiles')
                .update({ is_free_tier_exhausted: true })
                .eq('id', user.id);

            if (error) {
                dbCapture(error, 'DB-FREE-TIER-WRITE-001', 'DatabaseService.markFreeTierExhausted.query');
            }
        } catch (error) {
            dbCapture(error, 'DB-FREE-TIER-WRITE-002', 'DatabaseService.markFreeTierExhausted');
        }
    },

    // ─── Interviews ─────────────────────────────────────────

    async createInterview({ mode, topic, jdText, difficulty, totalQuestions }) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabaseClient
                .from('interviews')
                .insert({
                    user_id: user.id,
                    mode,
                    topic,
                    jd_text: jdText || null,
                    difficulty,
                    total_questions: totalQuestions,
                    status: 'in_progress'
                })
                .select()
                .single();

            if (error) {
                dbCapture(error, 'DB-INTERVIEW-CREATE-001', 'DatabaseService.createInterview.query');
                return null;
            }
            return data;
        } catch (error) {
            dbCapture(error, 'DB-INTERVIEW-CREATE-002', 'DatabaseService.createInterview');
            return null;
        }
    },

    async completeInterview(interviewId, scores, grade) {
        try {
            const { error } = await supabaseClient
                .from('interviews')
                .update({
                    overall_score: scores.overall,
                    accuracy: scores.accuracy,
                    depth: scores.depth,
                    clarity: scores.clarity,
                    relevance: scores.relevance,
                    practical: scores.practical,
                    grade,
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', interviewId);

            if (error) {
                dbCapture(error, 'DB-INTERVIEW-COMPLETE-001', 'DatabaseService.completeInterview.query', { interviewId });
            }
        } catch (error) {
            dbCapture(error, 'DB-INTERVIEW-COMPLETE-002', 'DatabaseService.completeInterview', { interviewId });
        }
    },

    async getInterview(interviewId) {
        try {
            const { data, error } = await supabaseClient
                .from('interviews')
                .select('*, questions(*)')
                .eq('id', interviewId)
                .single();

            if (error) {
                dbCapture(error, 'DB-INTERVIEW-GET-001', 'DatabaseService.getInterview.query', { interviewId });
                return null;
            }
            return data;
        } catch (error) {
            dbCapture(error, 'DB-INTERVIEW-GET-002', 'DatabaseService.getInterview', { interviewId });
            return null;
        }
    },

    async getInterviewHistory() {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabaseClient
                .from('interviews')
                .select('id, mode, topic, difficulty, total_questions, overall_score, grade, status, started_at, completed_at')
                .eq('user_id', user.id)
                .order('started_at', { ascending: false });

            if (error) {
                dbCapture(error, 'DB-HISTORY-GET-001', 'DatabaseService.getInterviewHistory.query');
                return [];
            }
            return data || [];
        } catch (error) {
            dbCapture(error, 'DB-HISTORY-GET-002', 'DatabaseService.getInterviewHistory');
            return [];
        }
    },

    // ─── Questions ──────────────────────────────────────────

    async saveQuestion(interviewId, { questionNumber, questionText, answerText, feedback, scores }) {
        try {
            const { data, error } = await supabaseClient
                .from('questions')
                .insert({
                    interview_id: interviewId,
                    question_number: questionNumber,
                    question_text: questionText,
                    answer_text: answerText,
                    feedback,
                    accuracy: scores.accuracy,
                    depth: scores.depth,
                    clarity: scores.clarity,
                    relevance: scores.relevance,
                    practical: scores.practicalKnowledge,
                    overall: scores.overall,
                    answered_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                dbCapture(error, 'DB-QUESTION-SAVE-001', 'DatabaseService.saveQuestion.query', { interviewId, questionNumber });
                return null;
            }
            return data;
        } catch (error) {
            dbCapture(error, 'DB-QUESTION-SAVE-002', 'DatabaseService.saveQuestion', { interviewId, questionNumber });
            return null;
        }
    },

    async getQuestionsByInterview(interviewId) {
        try {
            const { data, error } = await supabaseClient
                .from('questions')
                .select('*')
                .eq('interview_id', interviewId)
                .order('question_number', { ascending: true });

            if (error) {
                dbCapture(error, 'DB-QUESTION-GET-001', 'DatabaseService.getQuestionsByInterview.query', { interviewId });
                return [];
            }
            return data || [];
        } catch (error) {
            dbCapture(error, 'DB-QUESTION-GET-002', 'DatabaseService.getQuestionsByInterview', { interviewId });
            return [];
        }
    },

    // ─── Payments (Edge Function calls) ─────────────────────

    async callEdgeFunction(action, body) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                dbThrow(new Error('Not authenticated'), 'DB-EDGE-AUTH-001', 'DatabaseService.callEdgeFunction.auth', { action });
            }

            const res = await fetch(`${SUPABASE_URL}/functions/v1/razorpay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ action, ...body }),
            });

            let data = {};
            try {
                data = await res.json();
            } catch (parseError) {
                dbCapture(parseError, 'DB-EDGE-PARSE-001', 'DatabaseService.callEdgeFunction.parse', { action });
            }

            if (!res.ok) {
                dbThrow(new Error(data.error || 'Edge function call failed'), 'DB-EDGE-HTTP-001', 'DatabaseService.callEdgeFunction.http', { action, status: res.status });
            }
            return data;
        } catch (error) {
            dbThrow(error, 'DB-EDGE-UNHANDLED-001', 'DatabaseService.callEdgeFunction', { action });
        }
    },

    async createPaymentOrder(amount, tier) {
        return this.callEdgeFunction('create-order', { amount, tier });
    },

    async verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentId) {
        return this.callEdgeFunction('verify-payment', {
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: razorpaySignature,
            payment_id: paymentId,
        });
    }
};
