self.addEventListener("install", (event) => {
  console.log("SUR Aloeswood Service Worker Installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("SUR Aloeswood Service Worker Activated");
});

self.addEventListener("fetch", (event) => {});