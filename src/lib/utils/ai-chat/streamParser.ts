export interface ThinkStreamResult {
  answer: string;
  thinking?: string;
}

export interface StreamDelta {
  answerDelta: string;
  thinkingDelta: string;
}

export function createThinkStreamParser() {
  let buf = '';
  let inThink = false;
  let thinking = '';
  let answer = '';
  let raw = '';

  function feed(chunk: string): StreamDelta {
    if (!chunk) return { answerDelta: '', thinkingDelta: '' };
    raw += chunk;
    buf += chunk;

    const KEEP_TAIL = 16;
    let work = buf;
    if (work.length > KEEP_TAIL) {
      buf = work.slice(-KEEP_TAIL);
      work = work.slice(0, -KEEP_TAIL);
    }

    let outAnswer = '';
    let outThinking = '';

    while (work.length) {
      const openIdx = work.indexOf('<think>');
      const closeIdx = work.indexOf('</think>');

      if (!inThink) {
        if (openIdx === -1) {
          answer += work;
          outAnswer += work;
          work = '';
        } else {
          const before = work.slice(0, openIdx);
          if (before) {
            answer += before;
            outAnswer += before;
          }
          work = work.slice(openIdx + 7);
          inThink = true;
        }
      } else {
        if (closeIdx === -1) {
          thinking += work;
          outThinking += work;
          work = '';
        } else {
          const inside = work.slice(0, closeIdx);
          thinking += inside;
          outThinking += inside;
          work = work.slice(closeIdx + 8);
          inThink = false;
        }
      }
    }

    return { answerDelta: outAnswer, thinkingDelta: outThinking };
  }

  function flush(): ThinkStreamResult {
    return extractThinking(raw);
  }

  return { feed, flush };
}

export function extractThinking(raw: string): ThinkStreamResult {
  if (!raw) return { answer: '' };

  const start = raw.indexOf('<think>');
  const end = raw.indexOf('</think>');

  if (start !== -1 && end !== -1 && end > start) {
    const thinking = raw.slice(start + 7, end).trim();
    const answer = (raw.slice(0, start) + raw.slice(end + 8)).trim();
    return {
      answer: answer || raw,
      thinking: thinking || undefined
    };
  }

  return { answer: raw };
}
