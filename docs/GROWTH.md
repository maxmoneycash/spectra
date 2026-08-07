# Growth — how SPECTRA finds users

The mission is teaching people RF. Everything here follows from one fact: **the
two barriers to learning radio are owning hardware and installing native
software, and SPECTRA removes both.** That is the whole pitch, and it is
legible in about four seconds on a phone.

---

## Who this is actually for

Ranked by how quickly they convert, not by market size.

| Segment | Size / signal | What they want | Our hook |
|---|---|---|---|
| **Ham licence candidates** | ~30k new US licences/year; steady, recurring demand | To pass Technician | 1,431 questions, narrated, free, no signup |
| **SDR hobbyists** | r/RTLSDR + r/amateurradio are large and highly engaged | To see signals and understand them | A live waterfall with no dongle |
| **RF security / CTF players** | DEF CON RF Village, wireless CTFs, infosec Discords | A practice range between conferences | Ten graded RF challenges in a browser |
| **Students & educators** | EE/physics courses, STEM clubs | A shareable, install-free lab | Deterministic scenarios everyone can open at once |
| **The RF-curious** | Long tail from search and social | To know what a signal *is* | The signal library — see and hear each mode |

The first two are where to start. They already congregate in a handful of
places and they evaluate tools like this in one click.

---

## Channels, ranked by fit

**1. Reddit — r/amateurradio, r/RTLSDR, r/sdr.**
The highest-fit audience on the internet, and show-and-tell posts do well there.
Lead with the hardware-free claim and a waterfall GIF; do not lead with the exam
trainer — that reads as an ad. Post as a builder sharing a thing, answer every
comment, and expect the top question to be "is the DSP real?" (it is: hand-written
FFT, FIR channelizers, Weaver SSB — say so).

**2. Hacker News — Show HN.**
Angle is the engineering, not the product: a full software-defined receiver and
a multi-emitter RF simulator running in a browser tab at 1.152 MSPS. HN rewards
"here's how it works" over "here's what it does." The DSP test suite and the
`RESEARCH.md` gap analysis are the credibility artifacts.

**3. DEF CON RF Village / wireless CTF communities.**
The CTF is purpose-built for this crowd and there is no browser-based equivalent.
Offer it as an off-season practice range, and offer to author a village-branded
challenge set — that converts an audience into a partnership.

**4. Ham YouTube.**
A handful of channels own ham education. A working demo link is a low-ask pitch:
the reels and the CTF both demo in under a minute on camera. This is the highest-
leverage single channel if one of them bites.

**5. ARRL, QRZ, eHam, club newsletters.**
Slower and more formal, but this is where licence candidates are pointed by their
instructors. Worth a note to ARRL's education desk once the Technician reels have
been through a few users.

**6. Schools and clubs.**
Free, install-free, and deterministic scenarios mean a whole classroom sees the
identical spectrum. That is a genuinely hard thing to arrange with hardware.

---

## The share loops we have — and the ones we don't

**Working today**

- **Operator Card** — a generated image of your callsign-style record. Already the
  strongest artifact; it exists to be posted.
- **CTF score + rank** — solving flags produces a number and a title
  (Listener → Signals Officer). Numbers with titles get screenshotted.
- **Exam mastery %** — per-pool progress that grows with use.

**Missing, in priority order**

1. **Deep links.** The app has no URL state, so nobody can share *a specific
   thing* — a challenge, a band, a signal. `?ctf=morse-beacon` or `?band=ism`
   would turn every Reddit comment into a working link. This is the single
   cheapest growth feature we could build, and it is currently zero.
2. **A CTF share card.** The Wordle lesson is that a compact, spoiler-free
   result graphic travels further than a link. A 10-square grid of solved flags
   plus rank, as an image, is the natural fit.
3. **SEO surface.** The signal library and academy are genuinely searchable
   content — "what does LoRa look like on a waterfall" is a real query with weak
   answers. Today it is a single-route SPA, so none of it is indexable. Static
   routes per signal type would compound over time in a way social posts do not.
4. **A leaderboard.** Requires a backend (Vercel KV would do). Worth it only
   after the CTF has an audience; a leaderboard with four entries is worse than
   none.

---

## What I'd build next, for growth specifically

In order, cheapest-to-highest-impact first:

1. **URL state / deep links** — hours of work, unlocks every other channel.
2. **CTF result card** — reuses the Operator Card renderer.
3. **Static signal-library routes** — the compounding SEO play.
4. **A second CTF set** — the reason for people to come back. Content is the
   moat here: scenarios and challenges accumulate, and nobody can scrape them
   out of a competitor.

---

## What not to do

- **Don't gate anything behind signup.** The entire advantage is that it works
  in one click. A signup wall trades the differentiator for a metric.
- **Don't lead with the exam trainer on hobbyist channels.** Study tools read as
  homework; the waterfall reads as a toy you want to touch. Let the exam content
  be the thing they find after they're already inside.
- **Don't claim it replaces a radio.** It doesn't, and that audience will catch
  it instantly. It's the on-ramp *before* the radio — and the hardware-ingest
  path on the roadmap makes that a promise rather than a limitation.
