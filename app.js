/* 2026 유효회원 수강 분석 — 정적 리포트 스크립트 (외부 라이브러리 없음) */
(function () {
  'use strict';
  var D = window.DATA;
  var M = D.meta;
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- 유틸 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  var fc = function (n) { return Number(n).toLocaleString('ko-KR'); };
  var f1 = function (n) { return Number(n).toFixed(1); };
  var f2 = function (n) { return Number(n).toFixed(2); };
  var pct = function (n) { return f1(n) + '%'; };
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function C(i) { return cssv('--c' + ((i % 8) + 1)); }

  function h(tag, props) {
    var e = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      if (k === 'class') e.className = props[k];
      else e.setAttribute(k, props[k]);
    });
    for (var i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(e, k) {
    if (k == null) return;
    if (Array.isArray(k)) { k.forEach(function (x) { append(e, x); }); return; }
    if (typeof k === 'object' && k.b !== undefined) { var b = document.createElement('b'); b.textContent = k.b; e.appendChild(b); return; }
    if (k.nodeType) { e.appendChild(k); return; }
    e.appendChild(document.createTextNode(String(k)));
  }
  function sv(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  var ctx = document.createElement('canvas').getContext('2d');
  function tw(txt, size) {
    ctx.font = (size || 12) + 'px ' + getComputedStyle(document.body).fontFamily;
    return ctx.measureText(String(txt)).width;
  }
  function trunc(txt, max) {
    if (tw(txt) <= max) return txt;
    var s = String(txt);
    while (s.length > 1 && tw(s + '…') > max) s = s.slice(0, -1);
    return s + '…';
  }
  function niceTicks(max, n) {
    if (!(max > 0)) return [0, 1];
    var raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    var step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
    var t = [];
    for (var v = 0; ; v += step) { t.push(+v.toFixed(6)); if (v >= max) break; }
    return t;
  }
  function sum(a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0); }
  function maxBy(a, f) { return a.reduce(function (m, x) { return f(x) > f(m) ? x : m; }, a[0]); }
  function minBy(a, f) { return a.reduce(function (m, x) { return f(x) < f(m) ? x : m; }, a[0]); }

  /* ---------- 툴팁 ---------- */
  var tip = $('#tip');
  function showTip(ev, title, lines) {
    tip.textContent = '';
    tip.appendChild(h('div', { class: 'tt' }, title));
    lines.forEach(function (l) {
      var d = h('div');
      if (l.c) { var sw = h('span', { class: 'sw' }); sw.style.background = l.c; d.appendChild(sw); }
      d.appendChild(document.createTextNode(l.t));
      tip.appendChild(d);
    });
    tip.classList.add('show');
    var w = tip.offsetWidth, hh = tip.offsetHeight, x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 14;
    if (y + hh > window.innerHeight - 8) y = ev.clientY - hh - 14;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top = Math.max(4, y) + 'px';
  }
  function hideTip() { tip.classList.remove('show'); }
  function hover(el, fn) {
    el.addEventListener('pointermove', function (ev) { var t = fn(); showTip(ev, t.title, t.lines); });
    el.addEventListener('pointerleave', hideTip);
  }

  /* ---------- 차트 ---------- */
  function legend(box, items) {
    var d = h('div', { class: 'legend' });
    items.forEach(function (i) {
      var k = h('i'); k.style.background = i.color;
      d.appendChild(h('span', {}, k, i.name));
    });
    box.appendChild(d);
  }

  function hbar(box, rows, o) {
    box.textContent = '';
    if (o.legend) legend(box, o.legend);
    var W = Math.max(280, box.clientWidth), rh = o.rh || 27;
    var vl = o.vlabel || function (r) { return (o.vfmt || fc)(o.value(r)); };
    var lw = Math.min(W * 0.5, Math.max.apply(null, rows.map(function (r) { return tw(o.label(r)); })) + 12);
    var rw = Math.max.apply(null, rows.map(function (r) { return tw(vl(r), 11.5); })) + 10;
    var H = rows.length * rh + 6;
    var maxv = o.max != null ? o.max : Math.max.apply(null, rows.map(o.value));
    var span = Math.max(10, W - lw - rw);
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    rows.forEach(function (r, i) {
      var g = sv('g', { transform: 'translate(0,' + (i * rh + 3) + ')' });
      var lab = sv('text', { class: 't-lab', x: lw - 8, y: rh / 2, dy: '0.32em', 'text-anchor': 'end' });
      lab.textContent = trunc(o.label(r), lw - 12);
      var w = Math.max(1, o.value(r) / maxv * span);
      var bar = sv('rect', { x: lw, y: (rh - 16) / 2, width: w, height: 16, rx: 4, fill: o.color ? o.color(r) : C(0), opacity: o.dim && o.dim(r) ? 0.4 : 1 });
      var val = sv('text', { class: 't-val', x: lw + w + 6, y: rh / 2, dy: '0.32em' });
      val.textContent = vl(r);
      var ov = sv('rect', { x: 0, y: 0, width: W, height: rh, fill: 'transparent' });
      hover(ov, function () { return o.tip(r); });
      g.appendChild(lab); g.appendChild(bar); g.appendChild(val); g.appendChild(ov);
      svg.appendChild(g);
    });
    box.appendChild(svg);
  }

  function vbar(box, cats, series, o) {
    o = o || {};
    box.textContent = '';
    if (series.length > 1) legend(box, series.map(function (s) { return { name: s.name, color: s.color }; }));
    var W = Math.max(280, box.clientWidth), H = o.h || 240, vf = o.vfmt || fc, tf = o.tfmt || fc;
    var val = function (s, c) { return s.v[c] || 0; };
    var tot = function (c) { return o.stack ? sum(series, function (s) { return val(s, c); }) : Math.max.apply(null, series.map(function (s) { return val(s, c); })); };
    var ymaxRaw = o.max != null ? o.max : Math.max.apply(null, cats.map(tot));
    var ticks = niceTicks(ymaxRaw, 4), ymax = ticks[ticks.length - 1];
    var mt = 22, mr = 8, ml = Math.max.apply(null, ticks.map(function (t) { return tw(tf(t), 11); })) + 12;
    var step = (W - ml - mr) / cats.length, bw = step * 0.72;
    var maxLab = Math.max.apply(null, cats.map(function (c) { return tw(c, 11); }));
    var rot = maxLab > step - 6;
    var mb = rot ? maxLab * 0.62 + 18 : 28;
    var yp = function (v) { return H - mb - v / ymax * (H - mb - mt); };
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    ticks.forEach(function (t) {
      svg.appendChild(sv('line', { x1: ml, x2: W - mr, y1: yp(t), y2: yp(t), stroke: cssv('--grid'), 'stroke-width': 1 }));
      var tt = sv('text', { class: 't-tick', x: ml - 6, y: yp(t), dy: '0.32em', 'text-anchor': 'end' });
      tt.textContent = tf(t); svg.appendChild(tt);
    });
    cats.forEach(function (c, i) {
      var x0 = ml + i * step + (step - bw) / 2;
      var op = o.dim && o.dim(c) ? 0.4 : 1;
      if (o.stack) {
        var acc = 0;
        series.forEach(function (s) {
          var v = val(s, c); if (!v) return;
          svg.appendChild(sv('rect', { x: x0, width: bw, y: yp(acc + v), height: yp(acc) - yp(acc + v), fill: s.color, opacity: op }));
          acc += v;
        });
        var lab = vf(acc);
        if (o.labels !== false && tw(lab, 11.5) < step - 2) {
          var t1 = sv('text', { class: 't-val', x: x0 + bw / 2, y: yp(acc) - 5, 'text-anchor': 'middle' }); t1.textContent = lab; svg.appendChild(t1);
        }
      } else {
        var n = series.length, gw = bw / n;
        series.forEach(function (s, j) {
          var v = val(s, c), bx = x0 + j * gw;
          svg.appendChild(sv('rect', { x: bx + (n > 1 ? 1 : 0), width: Math.max(1, gw - (n > 1 ? 2 : 0)), y: yp(v), height: Math.max(0, yp(0) - yp(v)), rx: 3, fill: o.color ? o.color(c) : s.color, opacity: op }));
          var lab2 = vf(v);
          if (o.labels !== false && n === 1 && tw(lab2, 11.5) < step - 2) {
            var t2 = sv('text', { class: 't-val', x: bx + gw / 2, y: yp(v) - 5, 'text-anchor': 'middle' }); t2.textContent = lab2; svg.appendChild(t2);
          }
        });
      }
      var lx = ml + i * step + step / 2, ly = H - mb + 15;
      var tx = sv('text', { class: 't-tick', x: lx, y: ly });
      tx.textContent = c;
      if (rot) { tx.setAttribute('text-anchor', 'end'); tx.setAttribute('transform', 'rotate(-35 ' + lx + ' ' + ly + ')'); }
      else tx.setAttribute('text-anchor', 'middle');
      svg.appendChild(tx);
    });
    if (o.ref) {
      svg.appendChild(sv('line', { x1: ml, x2: W - mr, y1: yp(o.ref.v), y2: yp(o.ref.v), stroke: cssv('--muted'), 'stroke-dasharray': '4 3' }));
      var rt = sv('text', { class: 't-tick', x: W - mr, y: 10, 'text-anchor': 'end' });
      rt.textContent = '┄ ' + o.ref.label; svg.appendChild(rt);
    }
    cats.forEach(function (c, i) {
      var ov = sv('rect', { x: ml + i * step, width: step, y: mt - 6, height: H - mb - mt + 6, fill: 'transparent' });
      hover(ov, function () { return o.tip(c); });
      svg.appendChild(ov);
    });
    box.appendChild(svg);
  }

  function mkSeries(rows, ck, defs) {
    return defs.map(function (d) {
      var v = {}; rows.forEach(function (r) { v[r[ck]] = Number(r[d.key]); });
      return { name: d.name, color: d.color, v: v };
    });
  }

  /* ---------- 표 ---------- */
  function table(tb, cols, rows, o) {
    o = o || {};
    var sort = o.sort ? { key: o.sort.key, dir: o.sort.dir } : null;
    function draw() {
      tb.textContent = '';
      var tr = h('tr');
      cols.forEach(function (c) {
        var th = h('th', { scope: 'col', class: (c.num ? 'r ' : '') + (o.sortable === false ? '' : 'sortable') }, c.label);
        if (sort && sort.key === c.key) th.setAttribute('aria-sort', sort.dir === 'asc' ? 'ascending' : 'descending');
        if (o.sortable !== false) th.addEventListener('click', function () {
          sort = sort && sort.key === c.key ? { key: c.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.num ? 'desc' : 'asc' };
          draw();
        });
        tr.appendChild(th);
      });
      tb.appendChild(h('thead', {}, tr));
      var data = rows.filter(o.filter || function () { return true; });
      if (sort) data.sort(function (a, b) {
        var x = a[sort.key], y = b[sort.key];
        var r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ko');
        return sort.dir === 'asc' ? r : -r;
      });
      var body = h('tbody');
      var maxes = {};
      cols.forEach(function (c) { if (c.bar) maxes[c.key] = Math.max.apply(null, rows.map(function (r) { return r[c.key]; })); });
      data.forEach(function (r) {
        var row = h('tr');
        cols.forEach(function (c) {
          var v = r[c.key], txt = c.fmt ? c.fmt(v, r) : v, td;
          if (c.bar) {
            var bar = h('div', { class: 'bar' }); bar.style.width = Math.max(1, v / maxes[c.key] * 90) + 'px';
            td = h('td', { class: 'r' }, h('div', { class: 'inbar' }, bar, h('span', {}, txt)));
          } else td = h('td', { class: c.num ? 'r' : '' }, txt);
          row.appendChild(td);
        });
        body.appendChild(row);
      });
      if (!data.length) body.appendChild(h('tr', {}, h('td', { colspan: cols.length }, '검색 결과가 없습니다.')));
      tb.appendChild(body);
    }
    draw();
    return { draw: draw };
  }

  /* ---------- 데이터 가공 ---------- */
  var FIELDS = ['평생교육', '스포츠', '헬스'];
  var AGE_ORDER = D.age.map(function (r) { return r['연령대']; });
  var retAll = D.retention.filter(function (r) { return r['구간'] === '2026-04→2026-10'; })[0];
  var ageBig = D.age.filter(function (r) { return r['재등록기준'] >= 50; });
  var multi = D.field_combo.filter(function (r) { return r['조합'].indexOf('+') >= 0; });
  var multiN = sum(multi, function (r) { return r['회원수']; });
  var catMulti = M.members - M.cat_per_member['1'];
  var topPair = D.combo.filter(function (r) { return r['조합'].split('+').length === 2; })
    .sort(function (a, b) { return b['회원수'] - a['회원수']; }).slice(0, 2);
  var fa = function (f, a) { var r = D.field_age.filter(function (x) { return x['분야'] === f && x['연령대'] === a; })[0]; return r ? r['회원수'] : 0; };
  var fTot = function (f) { return D.field_summary.filter(function (r) { return r['분야'] === f; })[0]['회원수']; };
  var yShare = function (f) { return (fa(f, '20대') + fa(f, '30대')) / fTot(f) * 100; };
  var seniorShare = (fa('평생교육', '60대') + fa('평생교육', '70대') + fa('평생교육', '80세 이상')) / fTot('평생교육') * 100;
  var topAge = maxBy(D.age, function (r) { return r['회원수']; });
  var sizeTop = maxBy(D.classsize, function (r) { return r['수강반수']; });

  /* ---------- 고정 영역 ---------- */
  function renderStatic() {
    var tiles = $('#tiles');
    [
      ['유효회원', fc(M.members), '명', '카드번호 기준 고유 회원'],
      ['수강 건수', fc(M.rows_dedup), '건', '회원·수강일자·수강반 기준 중복 제거 후'],
      ['회원당 평균 수강반', f2(M.class_mean), '개', '전체 회원 기준'],
      ['문화강좌 재등록률', f1(retAll['재등록률']), '%', '2026-04 학기 → 2026-10 학기']
    ].forEach(function (t) {
      tiles.appendChild(h('div', { class: 'tile' }, h('div', { class: 'lab' }, t[0]), h('div', { class: 'num' }, t[1], h('small', {}, t[2])), h('div', { class: 'sub' }, t[3])));
    });

    var finds = $('#finds');
    var li = function () { var a = Array.prototype.slice.call(arguments); finds.appendChild(h('li', {}, a)); };
    li('유효회원 ', { b: fc(M.members) + '명' }, ' 중 여자 ', { b: pct(M.female / M.members * 100) }, ', 남자 ', { b: pct(M.male / M.members * 100) }, '입니다. 연령대별로는 ', { b: topAge['연령대'] + '(' + fc(topAge['회원수']) + '명)' }, '의 회원 수가 가장 많습니다.');
    li('분야별 회원은 평생교육 ', { b: fc(fTot('평생교육')) + '명' }, ', 스포츠 ', { b: fc(fTot('스포츠')) + '명' }, ', 헬스 ', { b: fc(fTot('헬스')) + '명' }, '이며, 둘 이상 분야를 이용한 회원은 ', { b: fc(multiN) + '명' }, '입니다.');
    li('평생교육은 60대 이상 비중이 ', { b: pct(seniorShare) }, '입니다. 20·30대 비중은 헬스 ', { b: pct(yShare('헬스')) }, ', 스포츠 ', { b: pct(yShare('스포츠')) }, ', 평생교육 ', { b: pct(yShare('평생교육')) }, '입니다.');
    var hi = maxBy(ageBig, function (r) { return r['재등록률']; }), lo = minBy(ageBig, function (r) { return r['재등록률']; });
    li('문화강좌 4월 학기 회원 ', { b: fc(retAll['기준회원']) + '명' }, ' 중 ', { b: fc(retAll['재등록']) + '명(' + pct(retAll['재등록률']) + ')' }, '이 10월에도 수강했습니다. 기준 회원 50명 이상 연령대 중 재등록률은 ', { b: hi['연령대'] + ' ' + pct(hi['재등록률']) }, '가 가장 높고 ', { b: lo['연령대'] + ' ' + pct(lo['재등록률']) }, '가 가장 낮습니다.');
    li('한 개 대분류만 수강한 회원이 ', { b: pct(M.cat_per_member['1'] / M.members * 100) }, '이고, 둘 이상 수강한 회원은 ', { b: fc(catMulti) + '명' }, '입니다. 조합은 ', { b: topPair[0]['조합'].replace(/\+/g, ' + ') + ' ' + fc(topPair[0]['회원수']) + '명' }, ', ', { b: topPair[1]['조합'].replace(/\+/g, ' + ') + ' ' + fc(topPair[1]['회원수']) + '명' }, ' 순입니다.');
    li('수강반 ', { b: fc(M.class_n) + '개' }, ' 중 ', { b: sizeTop['규모'] }, ' 규모가 ', { b: fc(sizeTop['수강반수']) + '개' }, '로 가장 많습니다.');

    // 분야 현황 표
    table($('#tb-field'), [
      { key: '분야', label: '분야' },
      { key: '회원수', label: '회원 수', num: 1, fmt: fc },
      { key: '수강건수', label: '수강 건수', num: 1, fmt: fc },
      { key: '여자', label: '여자', num: 1, fmt: fc },
      { key: '남자', label: '남자', num: 1, fmt: fc },
      { key: '연령중위', label: '연령 중위', num: 1, fmt: function (v) { return fc(v) + '세'; } },
      { key: '단독이용', label: '단독이용', num: 1, fmt: fc },
      { key: '복수분야이용', label: '복수분야이용', num: 1, fmt: fc }
    ], D.field_summary, { sortable: false });

    table($('#tb-fa'), [
      { key: '분야', label: '분야' },
      { key: '연령대', label: '연령대' },
      { key: '여자', label: '여자', num: 1, fmt: fc },
      { key: '남자', label: '남자', num: 1, fmt: fc },
      { key: '회원수', label: '합계', num: 1, fmt: fc }
    ], D.field_age, {});

    var q = '';
    var tsub = table($('#tb-sub'), [
      { key: '소분류', label: '소분류' },
      { key: '대분류', label: '대분류' },
      { key: '회원수', label: '회원 수', num: 1, bar: 1, fmt: fc },
      { key: '수강건수', label: '수강 건수', num: 1, fmt: fc },
      { key: '수강반수', label: '수강반 수', num: 1, fmt: fc }
    ], D.subcat, { sort: { key: '회원수', dir: 'desc' }, filter: function (r) { return !q || (r['소분류'] + ' ' + r['대분류']).indexOf(q) >= 0; } });
    $('#q-sub').addEventListener('input', function (e) { q = e.target.value.trim(); tsub.draw(); });

    table($('#tb-top'), [
      { key: '수강반', label: '수강반' },
      { key: '대분류', label: '대분류' },
      { key: '회원수', label: '회원 수', num: 1, bar: 1, fmt: fc }
    ], D.topclass, { sort: { key: '회원수', dir: 'desc' } });

    var basis = $('#basis-body');
    [
      ['동일인 식별', ': 카드번호가 같으면 한 사람으로 집계했습니다. 한 카드에 성별이나 나이가 서로 다르게 기록된 경우는 없었습니다. 한 사람이 카드를 여러 개 쓰는 경우는 구분할 수 없습니다.'],
      ['중복 제거', ': 원자료 ' + fc(M.rows_raw) + '행에서 회원·수강일자·수강반이 같은 행을 제거해 ' + fc(M.rows_dedup) + '행으로 분석했습니다.'],
      ['학기 구분', ': 수강일자는 학기 시작 기준일로 보이며 1·4·7·10월에 집중되어 있습니다. 월별 추세는 볼 수 없고 학기 단위로만 비교했습니다. 2026-07 학기는 회원이 적어 비교에서 제외했습니다.'],
      ['재등록 범위', ': 수영·생활체육·스쿼시·헬스는 2026-01(헬스는 2025-12) 이후 데이터가 없어 재등록을 계산하지 않았습니다. 재등록률은 문화강좌만 대상으로 합니다.'],
      ['분야 분류', ': 평생교육은 문화강좌(대면)와 특강, 스포츠는 수영(아쿠아)·생활체육·스쿼시, 헬스는 헬스 대분류입니다. 분류 기준은 분석 담당자가 정의한 것입니다.'],
      ['식별정보', ': 카드번호는 집계에만 사용했고 이 문서에 포함하지 않았습니다. 강사명은 코드로 대체했습니다.'],
      ['제외 항목', ': 결제금액, 환불, 거주지, 신규·기존 구분 컬럼이 없어 매출·환불·지역 분석은 포함하지 않았습니다.']
    ].forEach(function (p) { basis.appendChild(h('p', {}, { b: p[0] }, p[1])); });

    $('#foot').appendChild(h('div', {}, '작성일 ' + M.created + ' · 출처: ' + M.source + ' (카드번호 기준 집계) · 분석 결과 엑셀 「2026_분야별_연령대_회원현황.xlsx」와 동일한 집계값입니다.'));
  }

  /* ---------- 차트 영역 ---------- */
  var state = { field: '평생교육' };

  function renderCharts() {
    hideTip();
    var c0 = C(0), c1 = C(1), c2 = C(2);

    var age = D.age;
    vbar($('#ch-age'), AGE_ORDER, mkSeries(age, '연령대', [{ name: '여자', key: '여자', color: c0 }, { name: '남자', key: '남자', color: c1 }]), {
      stack: true, h: 250,
      tip: function (c) { var r = age.filter(function (x) { return x['연령대'] === c; })[0]; return { title: c, lines: [{ c: c0, t: '여자 ' + fc(r['여자']) + '명' }, { c: c1, t: '남자 ' + fc(r['남자']) + '명' }, { t: '합계 ' + fc(r['회원수']) + '명' }] }; }
    });

    var cat = D.category.slice().sort(function (a, b) { return b['회원수'] - a['회원수']; });
    hbar($('#ch-cat'), cat, {
      label: function (r) { return r['대분류']; }, value: function (r) { return r['회원수']; },
      color: function (r) { return C(cat.indexOf(r)); },
      tip: function (r) { return { title: r['대분류'], lines: [{ t: '회원 ' + fc(r['회원수']) + '명' }, { t: '수강 건수 ' + fc(r['수강건수']) }] }; }
    });

    // 분야
    var fcats = AGE_ORDER, frows = D.field_age.filter(function (r) { return r['연령대'] !== '연령 미기재'; });
    var fser = FIELDS.map(function (f, i) {
      var v = {}; frows.filter(function (r) { return r['분야'] === f; }).forEach(function (r) { v[r['연령대']] = r['회원수']; });
      return { name: f, color: C(i), v: v };
    });
    vbar($('#ch-fage'), fcats, fser, {
      h: 270, labels: false,
      tip: function (c) { return { title: c, lines: fser.map(function (s) { return { c: s.color, t: s.name + ' ' + fc(s.v[c] || 0) + '명' }; }) }; }
    });

    var fi = FIELDS.indexOf(state.field);
    var comp = D.field_age.filter(function (r) { return r['분야'] === state.field && r['회원수'] > 0; });
    var ftot = sum(comp, function (r) { return r['회원수']; });
    hbar($('#ch-fcomp'), comp, {
      label: function (r) { return r['연령대']; }, value: function (r) { return r['회원수']; }, color: function () { return C(fi); },
      vlabel: function (r) { return fc(r['회원수']) + ' (' + pct(r['회원수'] / ftot * 100) + ')'; },
      tip: function (r) { return { title: state.field + ' · ' + r['연령대'], lines: [{ t: '회원 ' + fc(r['회원수']) + '명 (' + pct(r['회원수'] / ftot * 100) + ')' }, { t: '여자 ' + fc(r['여자']) + ' / 남자 ' + fc(r['남자']) }] }; }
    });

    hbar($('#ch-fcombo'), D.field_combo, {
      label: function (r) { return r['조합']; }, value: function (r) { return r['회원수']; },
      tip: function (r) { return { title: r['조합'], lines: [{ t: '회원 ' + fc(r['회원수']) + '명 (' + pct(r['회원수'] / M.members * 100) + ')' }] }; }
    });

    // 강좌 수요
    var cats = Array.from(new Set(D.subcat.map(function (r) { return r['대분류']; })));
    var colOf = function (c) { return C(cats.indexOf(c)); };
    var top = D.subcat.slice().sort(function (a, b) { return b['회원수'] - a['회원수']; }).slice(0, 15);
    hbar($('#ch-sub'), top, {
      label: function (r) { return r['소분류']; }, value: function (r) { return r['회원수']; }, color: function (r) { return colOf(r['대분류']); },
      legend: cats.map(function (c) { return { name: c, color: colOf(c) }; }),
      tip: function (r) { return { title: r['소분류'] + ' · ' + r['대분류'], lines: [{ t: '회원 ' + fc(r['회원수']) + '명' }, { t: '수강 건수 ' + fc(r['수강건수']) }, { t: '수강반 ' + fc(r['수강반수']) + '개' }] }; }
    });

    // 재등록
    var ret = D.retention;
    vbar($('#ch-ret'), ret.map(function (r) { return r['구간']; }), [{ name: '재등록률', color: c0, v: Object.fromEntries(ret.map(function (r) { return [r['구간'], r['재등록률']]; })) }], {
      max: 100, h: 240, vfmt: pct, tfmt: function (v) { return v + '%'; },
      tip: function (c) { var r = ret.filter(function (x) { return x['구간'] === c; })[0]; return { title: c, lines: [{ t: '재등록률 ' + pct(r['재등록률']) }, { t: '기준 회원 ' + fc(r['기준회원']) + '명' }, { t: '재등록 ' + fc(r['재등록']) + '명' }] }; }
    });
    var ageRow = function (c) { return age.filter(function (x) { return x['연령대'] === c; })[0]; };
    vbar($('#ch-retage'), AGE_ORDER, [{ name: '재등록률', color: c0, v: Object.fromEntries(age.map(function (r) { return [r['연령대'], r['재등록률']]; })) }], {
      max: 100, h: 250, vfmt: pct, tfmt: function (v) { return v + '%'; },
      ref: { v: retAll['재등록률'], label: '전체 ' + pct(retAll['재등록률']) },
      dim: function (c) { return ageRow(c)['재등록기준'] < 50; },
      tip: function (c) { var r = ageRow(c); return { title: c, lines: [{ t: '재등록률 ' + pct(r['재등록률']) }, { t: '기준 회원 ' + fc(r['재등록기준']) + '명' }, { t: '재등록 ' + fc(r['재등록']) + '명' }] }; }
    });
    var rs = D.retention_sub.slice().sort(function (a, b) { return b['기준회원'] - a['기준회원']; });
    hbar($('#ch-retsub'), rs, {
      label: function (r) { return r['소분류']; }, value: function (r) { return r['재등록률']; }, max: 100, vfmt: pct,
      dim: function (r) { return r['기준회원'] < 50; },
      tip: function (r) { return { title: r['소분류'], lines: [{ t: '재등록률 ' + pct(r['재등록률']) }, { t: '기준 회원 ' + fc(r['기준회원']) + '명' }, { t: '재등록 ' + fc(r['재등록']) + '명' }] }; }
    });

    // 교차수강
    var cn = Object.keys(M.cat_per_member).map(function (k) { return { n: k + '개 대분류', m: M.cat_per_member[k] }; });
    hbar($('#ch-catn'), cn, {
      label: function (r) { return r.n; }, value: function (r) { return r.m; },
      vlabel: function (r) { return fc(r.m) + ' (' + pct(r.m / M.members * 100) + ')'; },
      tip: function (r) { return { title: r.n, lines: [{ t: '회원 ' + fc(r.m) + '명 (' + pct(r.m / M.members * 100) + ')' }] }; }
    });
    var combo = D.combo.slice().sort(function (a, b) { return b['회원수'] - a['회원수']; });
    hbar($('#ch-combo'), combo, {
      label: function (r) { return r['조합'].replace(/\+/g, ' + '); }, value: function (r) { return r['회원수']; },
      tip: function (r) { return { title: r['조합'].replace(/\+/g, ' + '), lines: [{ t: '회원 ' + fc(r['회원수']) + '명' }] }; }
    });

    // 요일·시간대
    hbar($('#ch-wd'), D.weekday, {
      label: function (r) { return r['요일'].replace(/\|/g, '·'); }, value: function (r) { return r['회원수']; },
      tip: function (r) { return { title: r['요일'].replace(/\|/g, '·'), lines: [{ t: '회원 ' + fc(r['회원수']) + '명' }, { t: '수강반 ' + fc(r['수강반수']) + '개' }] }; }
    });
    var hours = Array.from(new Set(D.swim.map(function (r) { return r['시간']; }))).sort(function (a, b) { return Number(a) - Number(b); });
    var types = Array.from(new Set(D.swim.map(function (r) { return r['유형']; })));
    var sser = types.map(function (t, i) {
      var v = {}; D.swim.filter(function (r) { return r['유형'] === t; }).forEach(function (r) { v[pad(r['시간'])] = r['회원수']; });
      return { name: t, color: C(i), v: v };
    });
    function pad(x) { x = String(x); return x.length < 2 ? '0' + x : x; }
    var hcats = hours.map(pad);
    vbar($('#ch-swim'), hcats, sser, {
      stack: true, h: 250,
      tip: function (c) { return { title: c + '시', lines: sser.filter(function (s) { return s.v[c]; }).map(function (s) { return { c: s.color, t: s.name + ' ' + fc(s.v[c]) + '명' }; }) }; }
    });

    // 수강반 규모
    var cs = D.classsize;
    vbar($('#ch-size'), cs.map(function (r) { return r['규모']; }), [{ name: '수강반', color: c0, v: Object.fromEntries(cs.map(function (r) { return [r['규모'], r['수강반수']]; })) }], {
      h: 240,
      tip: function (c) { return { title: c, lines: [{ t: '수강반 ' + fc(cs.filter(function (x) { return x['규모'] === c; })[0]['수강반수']) + '개' }] }; }
    });
    var terms = Array.from(new Set(D.singing.map(function (r) { return r['학기']; }))).sort();
    var ins = Array.from(new Set(D.singing.map(function (r) { return r['강사']; }))).sort();
    var gser = ins.map(function (t, i) {
      var v = {}; D.singing.filter(function (r) { return r['강사'] === t; }).forEach(function (r) { v[r['학기']] = r['회원수']; });
      return { name: t, color: C(i), v: v };
    });
    vbar($('#ch-sing'), terms, gser, {
      h: 250, labels: false,
      tip: function (c) { return { title: c + ' 학기', lines: gser.map(function (s) { return { c: s.color, t: s.name + ' ' + fc(s.v[c] || 0) + '명' }; }) }; }
    });
  }

  /* ---------- 상호작용 ---------- */
  function initSeg() {
    var seg = $('#seg-field');
    FIELDS.forEach(function (f) {
      var b = h('button', { type: 'button', role: 'tab', 'aria-selected': f === state.field ? 'true' : 'false', class: f === state.field ? 'on' : '' }, f);
      b.addEventListener('click', function () {
        state.field = f;
        Array.prototype.forEach.call(seg.children, function (x) { var on = x.textContent === f; x.className = on ? 'on' : ''; x.setAttribute('aria-selected', on ? 'true' : 'false'); });
        renderCharts();
      });
      seg.appendChild(b);
    });
  }
  function initNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('main section').forEach(function (s) { io.observe(s); });
  }

  renderStatic();
  initSeg();
  initNav();
  renderCharts();
  var timer;
  window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(renderCharts, 150); });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', renderCharts);
  }
  document.documentElement.setAttribute('data-ready', '1');
})();
