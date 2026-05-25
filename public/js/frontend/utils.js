/**
 * Pure string and date utilities — no DOM, no imports, no side effects.
 * `chrono` is passed in from outside since it's lazy-loaded.
 */

export async function parseDateFromFilename(filename, chrono) {
  let matchedDate = null;
  let filenameWithoutDate = filename;

  const yearFirstDateRegex = /(?<!\d)[\[\(]{0,1}(1\d{3}|20\d{2})[-._]?(0[1-9]|1[0-2])[-._]?(0[1-9]|[12][0-9]|3[01])[\]\)]{0,1}(?!\d)/;
  const yearLastDateRegex  = /(?<!\d)[\[\(]{0,1}(0[1-9]|[12][0-9]|3[01])[-._]?(0[1-9]|1[0-2])[-._]?(1\d{3}|20\d{2})[\]\)]{0,1}(?!\d)/;

  const yearFirstMatch = filename.match(yearFirstDateRegex);
  if (yearFirstMatch) {
    const [fullMatch, year, month, day] = yearFirstMatch;
    const parsedDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
    matchedDate = parsedDate.toISOString().split('T')[0];
    filenameWithoutDate = filenameWithoutDate.replace(fullMatch, '').replace(/^[\s-_]+|[\s-_]+$/g, '');
    return { date: matchedDate, name: filenameWithoutDate };
  }

  const yearLastMatch = filename.match(yearLastDateRegex);
  if (yearLastMatch) {
    const [fullMatch, day, month, year] = yearLastMatch;
    const parsedDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
    matchedDate = parsedDate.toISOString().split('T')[0];
    filenameWithoutDate = filenameWithoutDate.replace(fullMatch, '').replace(/^[\s-_]+|[\s-_]+$/g, '');
    return { date: matchedDate, name: filenameWithoutDate };
  }

  let chronoParsedResult = [];
  if (chrono) {
    console.log('filename being parsed:', filename);
    chronoParsedResult = chrono.parse(filename);
  }
  if (chronoParsedResult.length > 0) {
    const parsedDate = chronoParsedResult[0].start.date();
    matchedDate = parsedDate.toISOString().split('T')[0];
    const matchedInputText = chronoParsedResult[0].text;
    console.log('matchedInputText:', matchedInputText);
    console.log('matchedDate:', matchedDate);
    filenameWithoutDate = filenameWithoutDate.replace(matchedInputText, '').replace(/^[\s-_]+|[\s-_]+$/g, '');
    console.log('filenameWithoutDate:', filenameWithoutDate);
    return { date: matchedDate, name: filenameWithoutDate };
  }

  return { date: null, name: filenameWithoutDate };
}

export function prettifyTitle(title) {
  title = title.replace(/\.[a-zA-Z0-9]{1,4}$/, '');
  title = title.replace(/_+/g, ' ');
  title = title.replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Z}]/gu, '');
  title = stripDoubleChars(title);
  return title.trim();
}

export function stripDoubleChars(str) {
  str = str.replace(/[_\s\-.,\\/]+/g, ' ');
  return str.trim();
}

export function stripUnsuitableChars(input) {
  return input
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Z}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function uniqueFilename(name, filesMap) {
  if (!filesMap.has(name)) return name;
  const dot  = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext  = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  while (filesMap.has(`${base} (${n})${ext}`)) n++;
  return `${base} (${n})${ext}`;
}
