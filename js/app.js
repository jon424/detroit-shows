(function () {
  "use strict";

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CONFIG;

  const VENUE_LABELS = {
    trinosophes: "Trinosophes",
    moondog: "Moondog Cafe",
  };

  const DEFAULT_VENUE_URLS = {
    trinosophes: "https://trinosophes.com/Events",
    moondog: "https://www.moondogcafedetroit.com/calendar",
  };

  const filtersContainer = document.getElementById("filters");
  const filterList = document.getElementById("filter-list");
  const hamburger = document.getElementById("hamburger");
  const eventsContainer = document.getElementById("events");
  let allEvents = [];
  let activeVenue = "all";

  hamburger.addEventListener("click", () => {
    filtersContainer.classList.toggle("open");
  });

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function fetchEvents() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb
      .from("events")
      .select("*")
      .gte("event_date", today)
      .order("event_date", { ascending: true });

    if (error) {
      console.error("Supabase query error:", error.message);
      eventsContainer.innerHTML =
        '<p class="no-events">could not load events</p>';
      return;
    }

    allEvents = data || [];
    buildFilters();
    render();
  }

  function buildFilters() {
    const venues = [...new Set(allEvents.map((e) => e.venue))].sort((a, b) =>
      (VENUE_LABELS[a] || a).localeCompare(VENUE_LABELS[b] || b)
    );

    let html = '<button class="filter-btn active" data-venue="all">All</button>';
    for (const v of venues) {
      const label = VENUE_LABELS[v] || v;
      html += `<button class="filter-btn" data-venue="${esc(v)}">${esc(label)}</button>`;
    }
    filterList.innerHTML = html;

    filterList.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        filterList
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeVenue = btn.dataset.venue;
        filtersContainer.classList.remove("open");
        render();
      });
    });
  }

  function render() {
    const filtered =
      activeVenue === "all"
        ? allEvents
        : allEvents.filter((e) => e.venue === activeVenue);

    if (filtered.length === 0) {
      eventsContainer.innerHTML =
        '<p class="no-events">no upcoming events</p>';
      return;
    }

    const groups = new Map();
    for (const ev of filtered) {
      const key = ev.event_date || "TBD";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    }

    let html = "";
    for (const [date, events] of groups) {
      html += `<section class="date-group">`;
      html += `<h2 class="date-heading">${formatDate(date)}</h2>`;
      for (const ev of events) {
        html += `<div class="event">`;
        const titleUrl = ev.venue_url || DEFAULT_VENUE_URLS[ev.venue] || "#";
        html += `<a href="${esc(titleUrl)}" target="_blank" rel="noopener" class="event-title">${esc(ev.title)}</a>`;
        if (ev.description) {
          html += `<div class="event-description">${esc(ev.description)}</div>`;
        }
        const venueUrl = ev.venue_url || DEFAULT_VENUE_URLS[ev.venue] || "#";
        html += `<a href="${esc(venueUrl)}" target="_blank" rel="noopener" class="event-venue" data-venue="${esc(ev.venue)}">${esc(VENUE_LABELS[ev.venue] || ev.venue)}</a>`;
        html += `</div>`;
      }
      html += `</section>`;
    }

    eventsContainer.innerHTML = html;
  }

  function formatDate(iso) {
    if (iso === "TBD") return "Date TBD";
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const month = date.toLocaleDateString("en-US", { month: "long" });
    return `${weekday}, ${month} ${d}`;
  }

  function esc(str) {
    if (!str) return "";
    const el = document.createElement("span");
    el.textContent = str;
    return el.innerHTML;
  }

  fetchEvents();
})();
