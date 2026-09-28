import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const buildParams = (filters) => {
  const p = {};
  if (filters.search) p.search = filters.search;
  if (filters.purchase_type) p.purchase_type = filters.purchase_type;
  if (filters.payment_mode) p.payment_mode = filters.payment_mode;
  if (filters.payment_by) p.payment_by = filters.payment_by;
  if (filters.approved !== "" && filters.approved !== undefined && filters.approved !== null)
    p.approved = filters.approved;
  if (filters.date_from) p.date_from = filters.date_from;
  if (filters.date_to) p.date_to = filters.date_to;
  return p;
};

export const getConfig = () => axios.get(`${API}/config`).then((r) => r.data);

export const setAuthToken = (token) => {
  if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete axios.defaults.headers.common["Authorization"];
};

export const login = (username, password) =>
  axios.post(`${API}/auth/login`, { username, password }).then((r) => r.data);

export const getMe = () => axios.get(`${API}/auth/me`).then((r) => r.data);

export const uploadBill = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return axios.post(`${API}/purchases/upload-bill`, fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

export const billUrl = (path) => `${API}/purchases/bill/${path}`;

export const listPurchases = (filters, page, pageSize) =>
  axios.get(`${API}/purchases`, { params: { ...buildParams(filters), page, page_size: pageSize } }).then((r) => r.data);

export const getStats = (filters) =>
  axios.get(`${API}/purchases/stats`, { params: buildParams(filters) }).then((r) => r.data);

export const createPurchase = (data) => axios.post(`${API}/purchases`, data).then((r) => r.data);

export const updatePurchase = (id, data) => axios.put(`${API}/purchases/${id}`, data).then((r) => r.data);

export const deletePurchase = (id) => axios.delete(`${API}/purchases/${id}`).then((r) => r.data);

export const setApproval = (id, approved) =>
  axios.patch(`${API}/purchases/${id}/approval`, { approved }).then((r) => r.data);

export const bulkApproval = (ids, approved = true) =>
  axios.patch(`${API}/purchases/approval/bulk`, { ids, approved }).then((r) => r.data);

export const exportUrl = (kind, filters) => {
  const params = new URLSearchParams(buildParams(filters)).toString();
  return `${API}/purchases/export/${kind}${params ? `?${params}` : ""}`;
};
