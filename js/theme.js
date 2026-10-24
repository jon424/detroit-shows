(function () {
  var saved = localStorage.getItem("theme");
  var theme = saved || "dark";
  document.documentElement.setAttribute("data-theme", theme);

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;

    btn.textContent = theme === "dark" ? "\u263C" : "\u263E";

    btn.addEventListener("click", function () {
      theme = theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
      btn.textContent = theme === "dark" ? "\u263C" : "\u263E";
    });
  });
})();
