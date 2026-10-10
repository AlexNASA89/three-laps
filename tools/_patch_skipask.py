import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(n): return open(os.path.join(ROOT, n), encoding="utf-8").read()
def wr(n, t): open(os.path.join(ROOT, n), "w", encoding="utf-8", newline="\n").write(t)
def rep(t, a, b):
    assert a in t, a[:80]
    return t.replace(a, b, 1)

t = rd("logic.js")
# вопрос о пропущенном задаётся по каждому кадру один раз: s.skipAsk = id'ы, о которых уже спрашивали
t = rep(t, '  if (skippedList(data, s).length && !s.skipAsked) return "skipped";',
           '  if (skippedList(data, s).some((i) => !(s.skipAsk || []).includes(i))) return "skipped";')
t = rep(t, 'const seenPass = (s, id)', 'const askAll = (data, s) => { s.skipAsk = [...new Set([...(s.skipAsk || []), ...skippedList(data, s)])]; };\nconst seenPass = (s, id)')
t = rep(t, '''      push(s, "skip", now); st.status = "skipped"; st.skipSeq = ++s.skipCounter;''',
           '''      push(s, "skip", now); st.status = "skipped"; st.skipSeq = ++s.skipCounter;
      if (!s.passMode) s.skipAsk = (s.skipAsk || []).filter((x) => x !== a.id);''')
t = rep(t, 's.passMode = false; s.declined = {}; s.skipAsked = false; fixCursor(data, s, true); break;', 's.passMode = false; s.declined = {}; s.skipAsk = []; fixCursor(data, s, true); break;')
t = rep(t, 'push(s, "pass", now); s.skipAsked = true; s.passes++;', 'push(s, "pass", now); askAll(data, s); s.passes++;')
t = rep(t, 'case "skipAsked": s.skipAsked = true; break;', 'case "skipAsked": askAll(data, s); break;')
t = rep(t, 's.skipAsked = false; s.saidNo = !!a.noAccess; s.passMode = false;', 's.saidNo = !!a.noAccess; s.passMode = false;')
t = rep(t, 's.declined = { 1: true, 2: true, 3: true }; s.skipAsked = true; s.saidNo = true;', 's.declined = { 1: true, 2: true, 3: true }; askAll(data, s); s.saidNo = true;')
t = rep(t, 's.skipAsked = true; s.passMode = false; s.cursor = nextAfter(data, s, null); break;', 'askAll(data, s); s.passMode = false; s.cursor = nextAfter(data, s, null); break;')
wr("logic.js", t)

t = rd("logic.test.mjs")
t = rep(t, 'assert.equal(s.skipAsked, true); assert.equal(s.saidNo, true);', 'assert.ok(s.skipAsk.length >= 1); assert.equal(s.saidNo, true);')
t += '''
test("круг 2 без доступа не возвращает на пропущенное из круга 1", () => {
  let s = mk({});
  for (let i = 0; i < 15; i++) s = L.act(data, s, { type: "skip", id: s.cursor });
  assert.equal(L.endState(data, s), "skipped");
  s = L.act(data, s, { type: "skipAsked" });
  assert.equal(L.endState(data, s), "stage");
  s = L.act(data, s, { type: "addStage", circle: 2, noAccess: true });
  assert.equal(L.endState(data, s), "stage");   // круг 3, а не «пропущенное» снова
  s = L.act(data, s, { type: "addStage", circle: 3, noAccess: true });
  assert.equal(L.endState(data, s), "summary");
});
'''
wr("logic.test.mjs", t)

t = rd("app.js")
t = rep(t, 'app.cur = { ...s2, skipAsked: false, saidNo: false, declined: {} };', 'app.cur = { ...s2, skipAsk: [], saidNo: false, declined: {} };')
wr("app.js", t)
print("ok")
