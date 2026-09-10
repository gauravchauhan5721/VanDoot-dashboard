export const apiConfig = {
  endpoint: process.env.NEXT_PUBLIC_GATEWAY_API_URL || "",
  websocket: process.env.NEXT_PUBLIC_GATEWAY_WS_URL || "",
  timeout: 8000,
};
