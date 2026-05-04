import axios from 'axios';

const BASE = '/api';

// ── Equipment ────────────────────────────────────────────────────────────────
export const getStats        = ()         => axios.get(`${BASE}/equipment/stats`).then(r => r.data);
export const getEquipment    = (params)   => axios.get(`${BASE}/equipment`, { params }).then(r => r.data);
export const getEquipmentById= (id)       => axios.get(`${BASE}/equipment/${id}`).then(r => r.data);
export const createEquipment = (fd)       => axios.post(`${BASE}/equipment`, fd).then(r => r.data);
export const updateEquipment = (id, fd)   => axios.put(`${BASE}/equipment/${id}`, fd).then(r => r.data);
export const deleteEquipment = (id)       => axios.delete(`${BASE}/equipment/${id}`).then(r => r.data);

// ── Checkouts ────────────────────────────────────────────────────────────────
export const getCheckouts    = ()         => axios.get(`${BASE}/checkouts`).then(r => r.data);
export const createCheckout  = (data)     => axios.post(`${BASE}/checkouts`, data).then(r => r.data);
export const returnAsset     = (id, equipmentId) =>
  axios.patch(`${BASE}/checkouts/${id}/return`, id === 0 ? { equipment_id: equipmentId } : {}).then(r => r.data);
export const getAssetCheckouts = (eqId)  => axios.get(`${BASE}/checkouts/asset/${eqId}`).then(r => r.data);
export const getUserCheckouts  = (userId) => axios.get(`${BASE}/checkouts/user/${userId}`).then(r => r.data);

// ── History ───────────────────────────────────────────────────────────────────
export const getHistory = (eqId) => {
  const params = eqId ? { equipment_id: eqId } : {};
  return axios.get(`${BASE}/history`, { params }).then(r => r.data);
};

// ── Master Data ───────────────────────────────────────────────────────────────
export const getMasterData    = (category) =>
  axios.get(`${BASE}/master-data`, { params: category ? { category } : {} }).then(r => r.data);
export const createMasterData = (data)     => axios.post(`${BASE}/master-data`, data).then(r => r.data);
export const updateMasterData = (id, data) => axios.put(`${BASE}/master-data/${id}`, data).then(r => r.data);
export const deleteMasterData = (id)       => axios.delete(`${BASE}/master-data/${id}`).then(r => r.data);

// ── Users ─────────────────────────────────────────────────────────────────────
export const getUsers    = (all = false)   => axios.get(`${BASE}/users`, { params: all ? { all: '1' } : {} }).then(r => r.data);
export const getUserById = (id)            => axios.get(`${BASE}/users/${id}`).then(r => r.data);
export const createUser  = (data)          => axios.post(`${BASE}/users`, data).then(r => r.data);
export const updateUser  = (id, data)      => axios.put(`${BASE}/users/${id}`, data).then(r => r.data);
export const deleteUser  = (id)            => axios.delete(`${BASE}/users/${id}`).then(r => r.data);
