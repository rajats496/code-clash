import api from './api';

export const problemApi = {
    // Get list of problems
    getProblems: (params = {}) => api.get('/problems', { params }),

    // Get single problem details
    getProblem: (id) => api.get(`/problems/${id}`),

    // Get daily problem
    getDailyProblem: () => api.get('/problems/daily'),

    // Create a new problem (Admin only)
    createProblem: (data) => api.post('/problems', data),
};

export default problemApi;
