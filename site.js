(() => {
  "use strict";

  const CACHE_PARAM = "_spw";
  const params = new URLSearchParams(window.location.search);
  const cacheBust = params.get(CACHE_PARAM) || "";

  const bustUrl = (rawUrl) => {
    if (!cacheBust || !rawUrl) return rawUrl;

    try {
      const url = new URL(rawUrl, window.location.href);

      if (url.origin !== window.location.origin) {
        return rawUrl;
      }

      url.searchParams.set("v", cacheBust);
      return url.href;
    } catch {
      return rawUrl;
    }
  };

  const applyCacheBust = () => {
    if (!cacheBust) return;

    document
      .querySelectorAll(
        'link[rel="stylesheet"][href], link[rel~="icon"][href], link[rel="apple-touch-icon"][href], link[rel="manifest"][href]'
      )
      .forEach((link) => {
        const href = link.getAttribute("href");
        const busted = bustUrl(href);

        if (busted && busted !== href) {
          link.href = busted;
        }
      });

    document.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      const busted = bustUrl(src);

      if (busted && busted !== src) {
        img.src = busted;
      }
    });

    document.querySelectorAll("source[src]").forEach((source) => {
      const src = source.getAttribute("src");
      const busted = bustUrl(src);

      if (busted && busted !== src) {
        source.src = busted;
      }
    });

    document.querySelectorAll("source[srcset]").forEach((source) => {
      const srcset = source.getAttribute("srcset");

      if (!srcset) return;

      source.setAttribute(
        "srcset",
        srcset
          .split(",")
          .map((candidate) => {
            const parts = candidate.trim().split(/\s+/);
            return [bustUrl(parts[0]), ...parts.slice(1)].join(" ");
          })
          .join(", ")
      );
    });

    document.querySelectorAll("[data-src]").forEach((el) => {
      const src = el.getAttribute("data-src");
      const busted = bustUrl(src);

      if (busted && busted !== src) {
        el.setAttribute("data-src", busted);
      }
    });

    document.documentElement.style.setProperty(
      "--spw-web-bg",
      `url("${bustUrl("./assets/web-bg.png")}")`
    );

    document.documentElement.style.setProperty(
      "--spw-mobile-bg",
      `url("${bustUrl("./assets/mobile-bg.png")}")`
    );

    document.documentElement.style.setProperty(
      "--spw-sky-bg",
      `url("${bustUrl("./assets/cool-sky.webp")}")`
    );

    window.setTimeout(() => {
      const cleanUrl = new URL(window.location.href);

      cleanUrl.searchParams.delete(CACHE_PARAM);

      window.history.replaceState(
        {},
        document.title,
        cleanUrl.pathname + cleanUrl.search + cleanUrl.hash
      );
    }, 250);
  };

  const initPullToRefresh = () => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const indicator = document.createElement("div");
    indicator.className = "spw-ptr";
    indicator.setAttribute("aria-hidden", "true");
    indicator.innerHTML =
      '<span class="spw-ptr-mark">↻</span>' +
      '<span class="spw-ptr-label">Pull to refresh</span>';

    document.body.appendChild(indicator);

    const label = indicator.querySelector(".spw-ptr-label");
    const threshold = 74;
    const maxPull = 118;

    let startX = 0;
    let startY = 0;
    let pullDistance = 0;
    let tracking = false;
    let verticalPull = false;
    let refreshing = false;

    const atTop = () =>
      window.scrollY <= 1 &&
      document.documentElement.scrollTop <= 1;

    const reset = () => {
      tracking = false;
      verticalPull = false;
      pullDistance = 0;

      indicator.classList.remove(
        "is-pulling",
        "is-ready",
        "is-refreshing"
      );

      indicator.style.transform =
        "translate3d(-50%, -64px, 0)";

      indicator.style.setProperty(
        "--spw-ptr-rotation",
        "0deg"
      );

      indicator.setAttribute("aria-hidden", "true");

      if (label) {
        label.textContent = "Pull to refresh";
      }
    };

    document.addEventListener(
      "touchstart",
      (event) => {
        if (
          refreshing ||
          !atTop() ||
          event.touches.length !== 1
        ) {
          return;
        }

        const touch = event.touches[0];

        startX = touch.clientX;
        startY = touch.clientY;
        pullDistance = 0;
        tracking = true;
        verticalPull = false;
      },
      { passive: true }
    );

    document.addEventListener(
      "touchmove",
      (event) => {
        if (
          !tracking ||
          refreshing ||
          event.touches.length !== 1
        ) {
          return;
        }

        const touch = event.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (!verticalPull) {
          if (dy <= 0 || !atTop()) {
            reset();
            return;
          }

          if (
            Math.abs(dx) <= 10 &&
            Math.abs(dy) <= 10
          ) {
            return;
          }

          if (dy < Math.abs(dx) * 1.2) {
            reset();
            return;
          }

          verticalPull = true;
        }

        if (!atTop()) {
          reset();
          return;
        }

        event.preventDefault();

        pullDistance = Math.min(maxPull, dy * 0.56);

        const progress =
          Math.min(1, pullDistance / threshold);

        const indicatorY =
          -64 + pullDistance * 0.82;

        indicator.classList.add("is-pulling");
        indicator.classList.toggle(
          "is-ready",
          pullDistance >= threshold
        );

        indicator.style.transform =
          `translate3d(-50%, ${indicatorY}px, 0)`;

        indicator.style.setProperty(
          "--spw-ptr-rotation",
          Math.round(progress * 260) + "deg"
        );

        indicator.setAttribute("aria-hidden", "false");

        if (label) {
          label.textContent =
            pullDistance >= threshold
              ? "Release to refresh"
              : "Pull to refresh";
        }
      },
      { passive: false }
    );

    const finishPull = () => {
      if (!tracking || refreshing) return;

      if (
        verticalPull &&
        pullDistance >= threshold
      ) {
        refreshing = true;
        tracking = false;

        indicator.classList.remove(
          "is-pulling",
          "is-ready"
        );

        indicator.classList.add("is-refreshing");

        indicator.style.transform =
          "translate3d(-50%, 10px, 0)";

        indicator.setAttribute("aria-hidden", "false");

        if (label) {
          label.textContent = "Refreshing";
        }

        window.setTimeout(() => {
          const url = new URL(window.location.href);

          url.searchParams.set(
            CACHE_PARAM,
            Date.now().toString(36)
          );

          window.location.replace(url.toString());
        }, 220);

        return;
      }

      reset();
    };

    document.addEventListener(
      "touchend",
      finishPull,
      { passive: true }
    );

    document.addEventListener(
      "touchcancel",
      reset,
      { passive: true }
    );
  };

  applyCacheBust();
  initPullToRefresh();
})();
