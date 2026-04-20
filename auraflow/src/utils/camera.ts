export async function requestCameraPermission(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (err) {
    throw new Error('无法访问摄像头：' + err);
  }
}