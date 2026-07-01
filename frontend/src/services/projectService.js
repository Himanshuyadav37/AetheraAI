import api from "./api";

export async function getProjects() {

  const response =
    await api.get(
      "/ai/executions"
    );

  return response.data;
}

export async function getExecution(
  id
) {

  const response =
    await api.get(
      `/ai/executions/${id}`
    );

  return response.data;
}