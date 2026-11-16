// GHAS js/redos (Inefficient regular expression) guard for unionSplit in selector/acme.js.
//
// Run from the dojo directory:
//     node tests/unit/selector/redos-unionSplit.js
// From a consumer project, use the path to this submodule:
//     node <path-to>/dojo/tests/unit/selector/redos-unionSplit.js
//
// Node-only regression/performance check: it is intentionally NOT listed in
// tests/unit/all.js, because that suite runs through Intern in a browser.
//
// What it checks:
//   1) the regex is extracted from the real (patched) acme.js and is disjoint
//   2) golden expectations: well-formed selectors split into the same segments as before
//   3) robustness: malformed selectors complete quickly (no hang)
//   4) ReDoS guard: adversarial input stays linear (< 100ms)
//
// The pre-fix regex intentionally does NOT appear in this file: the repository is
// CodeQL-scanned and embedding it would raise a new js/redos alert.
// Historical baseline of the pre-fix pattern (measured on V8, full String.match):
//   32 backslashes ~43 ms, 40 ~1.8 s, 44 ~12 s, 50 ~222 s, 60 ~minutes.
//
// Generated/modified by AI Kilo Code 7.8.18-gratex-027, used model gti-litellm/mimo-2.6-flash

var fs = require("fs");
var path = require("path");

var ACME = path.join(__dirname, "..", "..", "..", "selector", "acme.js");

var failures = 0;
function check(ok, label, detail) {
    console.log((ok ? "PASS  " : "FAIL  ") + label + (detail ? "  [" + detail + "]" : ""));
    if (!ok) { failures++; }
}

function ms(fn) {
    var t0 = process.hrtime.bigint();
    var r = fn();
    return { ms: Number(process.hrtime.bigint() - t0) / 1e6, result: r };
}

function times(n, unit) {
    var s = "";
    for (var i = 0; i < n; i++) { s += unit; }
    return s;
}

// --- locate the patched regex in the real acme.js --------------------------
var src = fs.readFileSync(ACME, "utf8");
var m = src.match(/query\.match\((\/[^\/\n]+\/g)\)/);
check(!!m, "regex literal extracted from selector/acme.js");
if (!m) { process.exit(1); }

var reSrc = m[1];
check(reSrc.indexOf("[^\"\\\\]") !== -1, "escape alternatives are disjoint ([^\"\\\\])", reSrc);

var PATCHED = new Function("return " + reSrc)();

// --- 2) golden expectations for well-formed selectors ---------------------
var cases = [
    { sel: "div.a, span#b", exp: ["div.a", "span#b"] },
    { sel: ".foo, .bar", exp: [".foo", ".bar"] },
    { sel: "input[type=\"text\"], button.x", exp: ["input[type=\"text\"]", "button.x"] },
    { sel: "a[href='/path'], img[src=\"b.png\"]", exp: ["a[href='/path']", "img[src=\"b.png\"]"] },
    { sel: "a[title=\"x,y\"], .c", exp: ["a[title=\"x,y\"]", ".c"] },
    { sel: "[data-json='{\"a\":1}'], .d", exp: ["[data-json='{\"a\":1}']", ".d"] },
    { sel: ".a\\:b, .c", exp: [".a\\:b", ".c"] },
    { sel: "input[name='C:\\temp\\x'], .e", exp: ["input[name='C:\\temp\\x']", ".e"] },
    { sel: "span[title='don\\'t'], .q", exp: ["span[title='don\\'t']", ".q"] },
    { sel: "td[align='center'], th[align='center']", exp: ["td[align='center']", "th[align='center']"] },
    { sel: "> .child, + .sibling", exp: ["> .child", "+ .sibling"] },
    { sel: "form > input[name=\"user[email]\"], label", exp: ["form > input[name=\"user[email]\"]", "label"] }
];

cases.forEach(function (c) {
    var got = c.sel.match(PATCHED);
    var ok = JSON.stringify(got) === JSON.stringify(c.exp);
    check(ok, "split: " + JSON.stringify(c.sel), "got=" + JSON.stringify(got));
});

// --- 3) malformed selectors: fast, no hang --------------------------------
var malformed = [
    "a[href=\"foo\\\"]",
    "div[data='bar\\']",
    "x\"" + times(10, "\\") + "a"
];

malformed.forEach(function (sel, i) {
    var r = ms(function () { return sel.match(PATCHED); });
    check(Array.isArray(r.result), "malformed #" + (i + 1) + " returns a result");
    check(r.ms < 50, "malformed #" + (i + 1) + " completes fast", r.ms.toFixed(3) + "ms");
});

// --- 4) ReDoS guard --------------------------------------------------------
// Quote followed by a long run of backslashes with no closing quote.
// Exponential on the pre-fix pattern (32 backslashes already ~43ms, 50 ~222s),
// linear on the patched one.
var attack = "x\"" + times(60, "\\") + "a";
var tAttack = ms(function () { return attack.match(PATCHED); });
check(tAttack.ms < 100, "ReDoS guard: 60 backslashes < 100ms", tAttack.ms.toFixed(3) + "ms");

// --- summary ---------------------------------------------------------------
console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);