import api from "./api";

export async function getSettings() {

  const response =
    await api.get(
      "/settings"
    );

  return response.data;
}

export async function saveSettings(
  data
) {

  const response =
    await api.post(
      "/settings",
      data
    );

  return response.data;
}