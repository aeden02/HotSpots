import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1',
    withCredentials: true,
});

const enc = encodeURIComponent;
const data = (promise) => promise.then((res) => res.data);

// ping
export const ping = () => data(api.get('/ping'));
export const pingError = () => data(api.get('/ping/give-me-an-error'));

// users
export const createAccount = ({ username, email, password, city }) => data(api.post('/users/createAccount', { username, email, password, city }));
export const login = ({ email, password }) => data(api.post('/users/login', { email, password }));
export const logout = () => data(api.post('/users/logout'));
export const getMe = () => data(api.get('/users/me'));
export const getUser = (username) => data(api.get(`/users/getUser/${enc(username)}`));
export const getAllUsers = () => data(api.get('/users/getAllUsers'));

// spots
export const seedCity = (city) => data(api.post('/spots/seedCity', { city }));
export const getSpot = (slug) => data(api.get(`/spots/getSpot/${enc(slug)}`));
export const getSpotsByCity = (city) => data(api.get(`/spots/getSpotsByCity/${enc(city)}`));
export const createSpot = ({ title, description, banner, category, address, tags = [] }) => data(api.post('/spots/createSpot', { title, description, banner, category, address, tags }));
export const getCities = () => data(api.get('/spots/getCities'));
export const getCityById = (id) => data(api.get(`/spots/getCityById/${enc(id)}`));
export default api;