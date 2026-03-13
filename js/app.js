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

  const eventsContainer = document.getElementById("events");
  let allEvents = [];
  let activeVenue = "all";

  // --- Supabase client ---
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // --- Fetch events ---
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
    render();
  }

  // --- Render ---
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

    // Group by date
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
        html += `<div class="event-title">${esc(ev.title)}</div>`;
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

  // --- Utilities ---
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

  // --- Filter buttons ---
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeVenue = btn.dataset.venue;
      render();
    });
  });

  // --- Init ---
  fetchEvents();
})();
