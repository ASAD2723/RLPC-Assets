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

export const listPurchases = (filters, page, pageSize) =>
  axios.get(`${API}/purchases`, { params: { ...buildParams(filters), page, page_size: pageSize } }).then((r) => r.data);

export const getStats = (filters) =>
  axios.get(`${API}/purchases/stats`, { params: buildParams(filters) }).then((r) => r.data);

export const createPurchase = (data) => axios.post(`${API}/purchases`, data).then((r) => r.data);

export const updatePurchase = (id, data) => axios.put(`${API}/purchases/${id}`, data).then((r) => r.data);

export const deletePurchase = (id) => axios.delete(`${API}/purchases/${id}`).then((r) => r.data);

export const exportUrl = (kind, filters) => {
  const params = new URLSearchParams(buildParams(filters)).toString();
  return `${API}/purchases/export/${kind}${params ? `?${params}` : ""}`;
};
