/*
Current version: v0.1.2

Check for new versions at: https://github.com/Bertogim/bluemap-web-auto-quality/releases
Download the auto-quality.js script and add it to your bluemap server
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

    const LOWEST_FPS = 20; //Distance will drop to minimum
    const LOW_FPS = 35; //Quality will drop to minimum
    const GOOD_FPS = 40; //Consider enough fps for a lower end machine
    const BEST_FPS = 50; //Consider minimum fps for a good end machine
    const VERYGOOD_FPS = 55; //Consider minimum fps for a top end machine

    let FPS_DECIDED_VALUE = 50 //By default 50, will change instantly

    let debug = false;


    let autoQualityEnabled = localStorage.getItem("autoQualityEnabled") !== "false"; // default true
    let autoHiresEnabled = localStorage.getItem("autoHiresEnabled") !== "false";     // default true
    let autoLowresEnabled = localStorage.getItem("autoLowresEnabled") !== "false";   // default true


    function loadStatsJs(callback) {
        if (window.Stats) return callback();

        const script = document.createElement("script");
        script.innerHTML =
            `// stats.js - http://github.com/mrdoob/stats.js
            (function (f, e) { "object" === typeof exports && "undefined" !== typeof module ? module.exports = e() : "function" === typeof define && define.amd ? define(e) : f.Stats = e() })(this, function () {
                var f = function () {
                    function e(a) { c.appendChild(a.dom); return a } function u(a) { for (var d = 0; d < c.children.length; d++)c.children[d].style.display = d === a ? "block" : "none"; l = a } var l = 0, c = document.createElement("div"); c.style.cssText = "position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000"; c.addEventListener("click", function (a) {
                        a.preventDefault();
                        u(++l % c.children.length)
                    }, !1); var k = (performance || Date).now(), g = k, a = 0, r = e(new f.Panel("FPS", "#0ff", "#002")), h = e(new f.Panel("MS", "#0f0", "#020")); if (self.performance && self.performance.memory) var t = e(new f.Panel("MB", "#f08", "#201")); u(0); return {
                        REVISION: 16, dom: c, addPanel: e, showPanel: u, begin: function () { k = (performance || Date).now() }, end: function () {
                            a++; var c = (performance || Date).now(); h.update(c - k, 200); if (c > g + 1E3 && (r.update(1E3 * a / (c - g), 100), g = c, a = 0, t)) {
                                var d = performance.memory; t.update(d.usedJSHeapSize /
                                    1048576, d.jsHeapSizeLimit / 1048576)
                            } return c
                        }, update: function () { k = this.end() }, domElement: c, setMode: u
                    }
                }; f.Panel = function (e, f, l) {
                    var c = Infinity, k = 0, g = Math.round, a = g(window.devicePixelRatio || 1), r = 80 * a, h = 48 * a, t = 3 * a, v = 2 * a, d = 3 * a, m = 15 * a, n = 74 * a, p = 30 * a, q = document.createElement("canvas"); q.width = r; q.height = h; q.style.cssText = "width:80px;height:48px"; var b = q.getContext("2d"); b.font = "bold " + 9 * a + "px Helvetica,Arial,sans-serif"; b.textBaseline = "top"; b.fillStyle = l; b.fillRect(0, 0, r, h); b.fillStyle = f; b.fillText(e, t, v);
                    b.fillRect(d, m, n, p); b.fillStyle = l; b.globalAlpha = .9; b.fillRect(d, m, n, p); return { dom: q, update: function (h, w) { c = Math.min(c, h); k = Math.max(k, h); b.fillStyle = l; b.globalAlpha = 1; b.fillRect(0, 0, r, m); b.fillStyle = f; b.fillText(g(h) + " " + e + " (" + g(c) + "-" + g(k) + ")", t, v); b.drawImage(q, d + a, m, n - a, p, d, m, n - a, p); b.fillRect(d + n - a, m, a, p); b.fillStyle = l; b.globalAlpha = .9; b.fillRect(d + n - a, m, a, g((1 - h / w) * p)) } }
                }; return f
            }); `;
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
        autoQualityBtn.innerHTML = `< div class="label" > Auto Quality</div > `;
        autoQualityBtn.style.cursor = "pointer";

        const autoHiresBtn = document.createElement("div");
        autoHiresBtn.id = "auto-hires-btn";
        autoHiresBtn.className = "simple-button active";
        autoHiresBtn.innerHTML = `< div class="label" > Auto HiRes</div > `;
        autoHiresBtn.style.cursor = "pointer";

        const autoLowresBtn = document.createElement("div");
        autoLowresBtn.id = "auto-lowres-btn";
        autoLowresBtn.className = "simple-button active";
        autoLowresBtn.innerHTML = `< div class="label" > Auto LowRes</div > `;
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

            if (fps < FPS_DECIDED_VALUE && fps >= LOWEST_FPS) {
                // Reduce distances more aggressively the lower the fps gets
                const fpsRatio = (FPS_DECIDED_VALUE - fps) / (FPS_DECIDED_VALUE - LOWEST_FPS); // 0..1
                const dynamicHiresStep = Math.round(DISTANCE_STEP_HIRES * (0.5 + fpsRatio * 1.5)); // 5..25
                const dynamicLowresStep = Math.round(DISTANCE_STEP_LOWRES * (0.5 + fpsRatio * 1.5)); // 50..250

                if (autoHiresEnabled && hires > HIRES_MIN) {
                    hires = Math.max(HIRES_MIN, hires - dynamicHiresStep);
                    changed = true;
                }

                if (autoLowresEnabled && lowres > LOWRES_MIN) {
                    lowres = Math.max(LOWRES_MIN, lowres - dynamicLowresStep);
                    changed = true;
                }

                if (changed) {
                    safeSetData("loadedHiresViewDistance", hires);
                    safeSetData("loadedLowresViewDistance", lowres);
                    if (debug) { console.log(`[AutoQuality] ↓ (adaptive) HIRES → ${hires}, LOWRES → ${lowres} (fps: ${fps})`) };
                }

            } else if (fps < LOWEST_FPS) {
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
                    if (debug) { console.log(`[AutoQuality] ⬇ HIRES → ${hires}, LOWRES → ${lowres} `) };
                }
            } else if (fps > FPS_DECIDED_VALUE) {
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
                    if (debug) { console.log(`[AutoQuality] ↑ HIRES → ${hires}, LOWRES → ${lowres} `) };
                }
            }
        }

        function updateQuality(fps) {
            if (!autoQualityEnabled) return;
            setTimeout(() => {
                let quality = bluemap.mapViewer.superSampling;

                if (fps > FPS_DECIDED_VALUE && quality < QUALITY_TARGET) {
                    let dynamicStep = Math.min(QUALITY_STEP + (fps - FPS_DECIDED_VALUE) * 0.012, 0.3);
                    quality = Math.min(QUALITY_TARGET, quality + dynamicStep);
                    quality = Math.round(quality * 100) / 100;

                    bluemap.mapViewer.superSampling = quality;
                    bluemap.saveUserSettings();
                    if (debug) {
                        console.log(`[AutoQuality] ↑ Quality → ${quality} (fps: ${fps}, step: ${dynamicStep.toFixed(2)
                            })`)
                    };
                } else if (
                    fps < LOW_FPS &&
                    quality > QUALITY_MIN &&
                    bluemap.mapViewer.data.loadedHiresViewDistance <= HIRES_MIN &&
                    bluemap.mapViewer.data.loadedLowresViewDistance <= LOWRES_MIN
                ) {
                    let dropStep = Math.min(QUALITY_STEP * 2 + (LOW_FPS - fps) * 0.01, 0.3);
                    quality = Math.max(QUALITY_MIN, quality - dropStep);
                    quality = Math.round(quality * 100) / 100;

                    bluemap.mapViewer.superSampling = quality;
                    bluemap.saveUserSettings();
                    if (debug) {
                        console.log(`[AutoQuality] ↓ Quality → ${quality} (fps: ${fps}, step: ${dropStep.toFixed(2)
                            })`)
                    };
                }
            }, 0);
        }

        let lastTime = performance.now();
        let frameCount = 0;
        let fps = 60;

        let animationFrameId = null;
        let isAnimating = false;

        function animate() {
            if (document.visibilityState !== "visible") return;

            // Marca que estamos animando
            isAnimating = true;

            frameCount++;
            const now = performance.now();

            if (now - lastTime >= REFRESH_INTERVAL_MS) {
                fps = Math.round((frameCount * 1000) / (now - lastTime));
                frameCount = 0;
                lastTime = now;

                const hires = bluemap.mapViewer.data.loadedHiresViewDistance;

                FPS_DECIDED_VALUE = hires > 160 ? VERYGOOD_FPS : hires > 120 ? BEST_FPS : hires > 0 ? GOOD_FPS : FPS_DECIDED_VALUE;

                adjustDistances(fps);
                updateQuality(fps);
            }

            animationFrameId = requestAnimationFrame(animate);
        }

        function startAnimationLoop() {
            if (!isAnimating && document.visibilityState === "visible") {
                lastTime = performance.now();
                frameCount = 0;
                animationFrameId = requestAnimationFrame(animate);
            }
        }

        function stopAnimationLoop() {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            isAnimating = false;
        }

        // Hook into visibility API
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                console.log("[AutoQuality] Resumed");
                setTimeout(() => {

                    startAnimationLoop();
                }, 100);
            } else {
                console.log("[AutoQuality] Paused");
                stopAnimationLoop();
            }
        });

        // Initial launch
        if (document.visibilityState === "visible") {
            startAnimationLoop();
        }

        console.log("Auto quality initiated.")

        // Periodically try to insert buttons if UI is visible
        setInterval(() => {
            const qualityGroup = document.querySelector("#app > div.side-menu > div.content > div > div.group:nth-child(3) > div");
            const hiresGroup = document.querySelector("#app > div.side-menu > div.content > div > div.group:nth-child(4) > div");
            const lowresGroup = document.querySelector("#app > div.side-menu > div.content > div > div.group:nth-child(4) > div");

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