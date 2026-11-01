
async function loadSiteVersion() {
  try {
    const response = await fetch(
      "./version.json?t=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Version information unavailable");
    }

    const data = await response.json();

    document.getElementById("site-version").textContent =
      data.version;

    document.getElementById("site-commit").textContent =
      data.commit;

    document.getElementById("site-updated").textContent =
      new Date(data.updated).toLocaleString();

  } catch (error) {
    console.error("Could not load website version:", error);

    document.getElementById("site-version").textContent =
      "Unavailable";
  }
}

loadSiteVersion();
