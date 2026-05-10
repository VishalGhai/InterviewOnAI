/* Database Service — all Supabase DB operations */

const DatabaseService = {

    // ─── Profile ────────────────────────────────────────────

    async getProfile() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) { console.error('getProfile error:', error); return null; }
        return data;
    },

    async isFreeTierExhausted() {
        const profile = await this.getProfile();
        return profile ? profile.is_free_tier_exhausted : false;
    },

    async markFreeTierExhausted() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('profiles')
            .update({ is_free_tier_exhausted: true })
            .eq('id', user.id);

        if (error) console.error('markFreeTierExhausted error:', error);
    },

    // ─── Interviews ─────────────────────────────────────────

    async createInterview({ mode, topic, jdText, difficulty, totalQuestions }) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
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

        if (error) { console.error('createInterview error:', error); return null; }
        return data;
    },

    async completeInterview(interviewId, scores, grade) {
        const { error } = await supabase
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

        if (error) console.error('completeInterview error:', error);
    },

    async getInterview(interviewId) {
        const { data, error } = await supabase
            .from('interviews')
            .select('*, questions(*)')
            .eq('id', interviewId)
            .single();

        if (error) { console.error('getInterview error:', error); return null; }
        return data;
    },

    async getInterviewHistory() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('interviews')
            .select('id, mode, topic, difficulty, total_questions, overall_score, grade, status, started_at, completed_at')
            .eq('user_id', user.id)
            .order('started_at', { ascending: false });

        if (error) { console.error('getInterviewHistory error:', error); return []; }
        return data || [];
    },

    // ─── Questions ──────────────────────────────────────────

    async saveQuestion(interviewId, { questionNumber, questionText, answerText, feedback, scores }) {
        const { data, error } = await supabase
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

        if (error) { console.error('saveQuestion error:', error); return null; }
        return data;
    },

    async getQuestionsByInterview(interviewId) {
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .eq('interview_id', interviewId)
            .order('question_number', { ascending: true });

        if (error) { console.error('getQuestionsByInterview error:', error); return []; }
        return data || [];
    }
};
