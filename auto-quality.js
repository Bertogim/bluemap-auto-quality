/*
Current version: v1.0.0
Check for new versions at https://github.com/Bertogim/bluemap-auto-quality/releases
Or add to your bluemap html -- to always have the latest version


*/
(function () {
    const REFRESH_INTERVAL_MS = 250;
    const HIRES_MIN = 60;
    const HIRES_MAX = 500;
    const LOWRES_MIN = 500;
    const LOWRES_MAX = 10000;
    const QUALITY_MIN = 0.4;
    const QUALITY_TARGET = 1.0;
    const QUALITY_STEP = 0.1;
    const DISTANCE_STEP_HIRES = 10;
    const DISTANCE_STEP_LOWRES = 100;

    let debug = false;


    let autoQualityEnabled = localStorage.getItem("autoQualityEnabled") !== "false"; // default true
    let autoHiresEnabled = localStorage.getItem("autoHiresEnabled") !== "false";     // default true
    let autoLowresEnabled = localStorage.getItem("autoLowresEnabled") !== "false";   // default true


    function loadStatsJs(callback) {
        if (window.Stats) return callback();

        const script = document.createElement("script");
        script.src =
            "https://rawcdn.githack.com/mrdoob/stats.js/r17/build/stats.min.js";
        script.onload = () => {
            if (window.Stats) callback();
            else console.error("Stats failed to load.");
        };
        document.head.appendChild(script);
    }

    function createAutoButtons(qualityGroup, hiresGroup, lowresGroup) {
        if (!qualityGroup || !hiresGroup || !lowresGroup) return false;

        // Avoid duplicate buttons
        if (
            document.getElementById("auto-quality-btn") &&
            document.getElementById("auto-hires-btn") &&
            document.getElementById("auto-lowres-btn")
        ) return false;

        const autoQualityBtn = document.createElement("div");
        autoQualityBtn.id = "auto-quality-btn";
        autoQualityBtn.className = "simple-button active";
        autoQualityBtn.innerHTML = `<div class="label">Auto Quality</div>`;
        autoQualityBtn.style.cursor = "pointer";

        const autoHiresBtn = document.createElement("div");
        autoHiresBtn.id = "auto-hires-btn";
        autoHiresBtn.className = "simple-button active";
        autoHiresBtn.innerHTML = `<div class="label">Auto HiRes</div>`;
        autoHiresBtn.style.cursor = "pointer";

        const autoLowresBtn = document.createElement("div");
        autoLowresBtn.id = "auto-lowres-btn";
        autoLowresBtn.className = "simple-button active";
        autoLowresBtn.innerHTML = `<div class="label">Auto LowRes</div>`;
        autoLowresBtn.style.cursor = "pointer";

        autoQualityBtn.classList.toggle("active", autoQualityEnabled);
        autoHiresBtn.classList.toggle("active", autoHiresEnabled);
        autoLowresBtn.classList.toggle("active", autoLowresEnabled);

        qualityGroup.appendChild(autoQualityBtn);
        hiresGroup.appendChild(autoHiresBtn);
        lowresGroup.appendChild(autoLowresBtn);

        return {
            autoQualityBtn,
            autoHiresBtn,
            autoLowresBtn
        };
    }

    function setupAutoQualityControl() {
        const stats = new Stats();
        stats.showPanel(0);
        stats.dom.style.display = "none";
        document.body.appendChild(stats.dom);

        function safeSetData(prop, val) {
            if (bluemap.mapViewer.data[prop] !== val) {
                bluemap.mapViewer.data[prop] = val;
                bluemap.mapViewer.updateLoadedMapArea();
                bluemap.saveUserSettings();
                return true;
            }
            return false;
        }

        function adjustDistances(fps) {
            let hires = bluemap.mapViewer.data.loadedHiresViewDistance;
            let lowres = bluemap.mapViewer.data.loadedLowresViewDistance;
            let changed = false;

            if (fps < 40 && fps >= 20) {
                if (autoHiresEnabled && hires > HIRES_MIN) {
                    hires = Math.max(HIRES_MIN, hires - DISTANCE_STEP_HIRES);
                    changed = true;
                }

                if (
                    autoLowresEnabled &&
                    lowres > LOWRES_MIN &&
                    (hires <= HIRES_MIN || !autoHiresEnabled)
                ) {
                    lowres = Math.max(LOWRES_MIN, lowres - DISTANCE_STEP_LOWRES);
                    changed = true;
                }

                if (changed) {
                    safeSetData("loadedHiresViewDistance", hires);
                    safeSetData("loadedLowresViewDistance", lowres);
                    if (debug) { console.log(`[AutoQuality] ↓ HIRES → ${hires}, LOWRES → ${lowres}`) };
                }
            } else if (fps < 20) {
                if (autoHiresEnabled && hires > HIRES_MIN) {
                    hires = HIRES_MIN;
                    changed = true;
                }

                if (autoLowresEnabled && lowres > LOWRES_MIN) {
                    lowres = LOWRES_MIN;
                    changed = true;
                }

                if (changed) {
                    safeSetData("loadedHiresViewDistance", hires);
                    safeSetData("loadedLowresViewDistance", lowres);
                    if (debug) { console.log(`[AutoQuality] ⬇ HIRES → ${hires}, LOWRES → ${lowres}`) };
                }
            } else if (fps > 55) {
                if (
                    autoHiresEnabled &&
                    hires < HIRES_MAX &&
                    bluemap.mapViewer.superSampling >= QUALITY_TARGET
                ) {
                    hires = Math.min(HIRES_MAX, hires + DISTANCE_STEP_HIRES);
                    changed = true;
                }

                if (
                    autoLowresEnabled &&
                    lowres < LOWRES_MAX &&
                    bluemap.mapViewer.superSampling >= QUALITY_TARGET
                ) {
                    lowres = Math.min(LOWRES_MAX, lowres + DISTANCE_STEP_LOWRES);
                    changed = true;
                }

                if (changed) {
                    safeSetData("loadedHiresViewDistance", hires);
                    safeSetData("loadedLowresViewDistance", lowres);
                    if (debug) { console.log(`[AutoQuality] ↑ HIRES → ${hires}, LOWRES → ${lowres}`) };
                }
            }
        }

        let pendingQuality = null;

        function updateQuality(fps) {
            if (!autoQualityEnabled) return;

            let quality = bluemap.mapViewer.superSampling;

            if (fps > 48 && quality < QUALITY_TARGET) {
                let dynamicStep = Math.min(QUALITY_STEP + (fps - 48) * 0.012, 0.3);
                quality = Math.min(QUALITY_TARGET, quality + dynamicStep);
                quality = Math.round(quality * 100) / 100;
                pendingQuality = quality;
            } else if (
                fps < 35 &&
                quality > QUALITY_MIN &&
                bluemap.mapViewer.data.loadedHiresViewDistance <= HIRES_MIN &&
                bluemap.mapViewer.data.loadedLowresViewDistance <= LOWRES_MIN
            ) {
                let dropStep = Math.min(QUALITY_STEP * 2 + (35 - fps) * 0.01, 0.3);
                quality = Math.max(QUALITY_MIN, quality - dropStep);
                quality = Math.round(quality * 100) / 100;
                pendingQuality = quality;
            }
        }

        // Then apply the update slightly after RAF:
        function animate() {
            stats.begin();
            stats.end();

            frameCount++;
            const now = performance.now();
            if (now - lastTime >= REFRESH_INTERVAL_MS) {
                fps = Math.round((frameCount * 1000) / (now - lastTime));
                frameCount = 0;
                lastTime = now;

                adjustDistances(fps);
                updateQuality(fps);
            }

            requestAnimationFrame(() => {
                if (pendingQuality !== null) {
                    bluemap.mapViewer.superSampling = pendingQuality;
                    bluemap.saveUserSettings();
                    console.log(`[AutoQuality] ↻ Quality → ${pendingQuality}`);
                    pendingQuality = null;
                }

                animate();
            });
        }


        let lastTime = performance.now();
        let frameCount = 0;
        let fps = 60;

        animate();
        console.log("Auto quality initiated.")

        // Periodically try to insert buttons if UI is visible
        setInterval(() => {
            const qualityGroup = document.querySelector("div.group:nth-child(3) > div:nth-child(2)");
            const hiresGroup = document.querySelector("div.group:nth-child(4) > div:nth-child(2)");
            const lowresGroup = document.querySelector("div.group:nth-child(4) > div:nth-child(2)");

            const buttons = createAutoButtons(qualityGroup, hiresGroup, lowresGroup);
            if (buttons) {
                buttons.autoQualityBtn.addEventListener("click", () => {
                    autoQualityEnabled = !autoQualityEnabled;
                    buttons.autoQualityBtn.classList.toggle("active", autoQualityEnabled);
                    localStorage.setItem("autoQualityEnabled", autoQualityEnabled);
                });
                buttons.autoHiresBtn.addEventListener("click", () => {
                    autoHiresEnabled = !autoHiresEnabled;
                    buttons.autoHiresBtn.classList.toggle("active", autoHiresEnabled);
                    localStorage.setItem("autoHiresEnabled", autoHiresEnabled);

                });
                buttons.autoLowresBtn.addEventListener("click", () => {
                    autoLowresEnabled = !autoLowresEnabled;
                    buttons.autoLowresBtn.classList.toggle("active", autoLowresEnabled);

                    localStorage.setItem("autoLowresEnabled", autoLowresEnabled);
                });
                if (debug) { console.log("[AutoQuality] Auto buttons injected.") };
            }
        }, 1000); // Check every second
    }

    const waitForBlueMap = setInterval(() => {
        if (
            window.bluemap &&
            bluemap.mapViewer &&
            typeof bluemap.mapViewer.superSampling === "number" &&
            bluemap.mapViewer.data &&
            typeof bluemap.mapViewer.data.loadedHiresViewDistance === "number" &&
            typeof bluemap.mapViewer.data.loadedLowresViewDistance === "number"
        ) {
            clearInterval(waitForBlueMap);
            loadStatsJs(setupAutoQualityControl);
        }
    }, 200);
})();