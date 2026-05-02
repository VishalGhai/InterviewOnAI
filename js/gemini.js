const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(contents) {
    const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function buildQuestionPrompt(context, difficulty, questionNumber, totalQuestions) {
    const difficultyMap = {
        'easy': 'easy level only',
        'easy-medium': questionNumber <= Math.ceil(totalQuestions / 2)
            ? 'easy level' : 'medium level',
        'easy-medium-hard': questionNumber <= Math.ceil(totalQuestions / 3)
            ? 'easy level'
            : questionNumber <= Math.ceil((totalQuestions * 2) / 3)
                ? 'medium level' : 'hard level'
    };

    const currentDifficulty = difficultyMap[difficulty] || 'medium level';

    return [
        {
            role: 'user',
            parts: [{
                text: `You are a technical interviewer conducting an interview. Here is the context:

${context}

This is question ${questionNumber} of ${totalQuestions}. Ask a ${currentDifficulty} interview question.

Rules:
- Ask exactly ONE question
- Make it specific and technical
- Do NOT include the answer
- Do NOT include any preamble like "Here's your question" or "Question ${questionNumber}:"
- Just ask the question directly
- Make sure each question covers a different topic/concept
- Progressively increase difficulty as question numbers increase`
            }]
        }
    ];
}

function buildEvaluationPrompt(question, answer, questionNumber) {
    return [
        {
            role: 'user',
            parts: [{
                text: `You are evaluating an interview answer. Score it strictly and fairly.

Question: ${question}

Candidate's Answer: ${answer}

Evaluate the answer on these 5 parameters (each 0-100):
1. accuracy - Correctness of the answer
2. depth - How thorough and detailed the explanation is
3. clarity - How well-structured and clear the response is
4. relevance - How directly it addresses the question
5. practicalKnowledge - Real-world application and examples

Scoring guidelines:
- 0-20: Completely wrong or irrelevant
- 21-40: Partially correct but major gaps
- 41-60: Acceptable but lacks depth
- 61-80: Good answer with minor gaps
- 81-100: Excellent, comprehensive answer

Also provide brief constructive feedback (2-3 sentences max).

Respond ONLY with valid JSON, no markdown formatting, no code blocks:
{"accuracy":0,"depth":0,"clarity":0,"relevance":0,"practicalKnowledge":0,"feedback":"..."}`
            }]
        }
    ];
}

async function extractKeywords(jobDescription) {
    const prompt = [
        {
            role: 'user',
            parts: [{
                text: `Extract the key technical skills, tools, frameworks, and concepts from this job description. Return ONLY a JSON array of short keyword strings (2-3 words max each). Extract 10-25 keywords. No explanation, no markdown.

Job Description:
${jobDescription}

Respond with ONLY a JSON array like: ["Java", "Spring Boot", "Microservices", ...]`
            }]
        }
    ];

    const response = await callGemini(prompt);
    try {
        const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const keywords = JSON.parse(cleaned);
        if (Array.isArray(keywords)) return keywords.map(k => String(k).trim()).filter(Boolean);
    } catch {}
    return [];
}

async function generateQuestion(context, difficulty, questionNumber, totalQuestions, previousQuestions, excludedTopics) {
    let prompt = buildQuestionPrompt(context, difficulty, questionNumber, totalQuestions);

    if (previousQuestions && previousQuestions.length > 0) {
        const prevList = previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
        prompt[0].parts[0].text += `\n\nPrevious questions asked (do NOT repeat or ask similar):\n${prevList}`;
    }

    if (excludedTopics && excludedTopics.length > 0) {
        prompt[0].parts[0].text += `\n\nDo NOT ask questions about these topics (the candidate has excluded them):\n${excludedTopics.join(', ')}`;
    }

    return await callGemini(prompt);
}

async function evaluateAnswer(question, answer, questionNumber) {
    const prompt = buildEvaluationPrompt(question, answer, questionNumber);
    const response = await callGemini(prompt);

    try {
        const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);

        const params = ['accuracy', 'depth', 'clarity', 'relevance', 'practicalKnowledge'];
        for (const p of params) {
            if (typeof parsed[p] !== 'number' || parsed[p] < 0 || parsed[p] > 100) {
                parsed[p] = 0;
            }
        }
        if (typeof parsed.feedback !== 'string') {
            parsed.feedback = 'No feedback available.';
        }

        return parsed;
    } catch {
        const numbers = response.match(/\d+/g)?.map(Number).filter(n => n >= 0 && n <= 100) || [];
        return {
            accuracy: numbers[0] || 0,
            depth: numbers[1] || 0,
            clarity: numbers[2] || 0,
            relevance: numbers[3] || 0,
            practicalKnowledge: numbers[4] || 0,
            feedback: 'Score parsed from response. Some details may be approximate.'
        };
    }
}
