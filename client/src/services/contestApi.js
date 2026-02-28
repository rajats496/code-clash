/**
 * Contest API Service
 * Wraps all contest-related REST endpoints
 */
import api from './api';

const contestApi = {
  // List contests (with optional status filter)
  list: (params = {}) => api.get('/contests', { params }),

  // Next upcoming contest (public, for home banner)
  upcoming: () => api.get('/contests/upcoming'),

  // Get contest details
  get: (id) => api.get(`/contests/${id}`),

  // Create a new contest
  create: (data) => api.post('/contests', data),

  // Register for a contest
  register: (id) => api.post(`/contests/${id}/register`),

  // Unregister from a contest
  unregister: (id) => api.delete(`/contests/${id}/register`),

  // Submit code for a problem in a contest
  submit: (contestId, { problemId, code, language, isSubmit }) =>
    api.post(`/contests/${contestId}/submit`, { problemId, code, language, isSubmit }),

  // Get leaderboard
  leaderboard: (id, params = {}) => api.get(`/contests/${id}/leaderboard`, { params }),

  // Get my submissions for a contest
  mySubmissions: (contestId, problemId) =>
    api.get(`/contests/${contestId}/submissions`, { params: { problemId } }),

  // Admin: start contest
  start: (id) => api.post(`/contests/${id}/start`),

  // Admin: end contest
  end: (id) => api.post(`/contests/${id}/end`),

  // Get all problems (for create-contest form)
  getProblems: () => api.get('/problems'),
};

export default contestApi;
