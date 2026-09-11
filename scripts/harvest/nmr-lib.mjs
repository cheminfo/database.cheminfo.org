/**
 * Reducing a Bruker NMR JCAMP-DX export to its spectrum.
 */
/**
 * Keep the header, the NTUPLES declaration and the real page of a Bruker
 * NMR JCAMP-DX export.
 * @param text - The file as downloaded.
 * @returns A valid JCAMP-DX holding the same measured points.
 */
export function reduceNmrJcamp(text) {
  const lines = text.split('\n');
  const out = [];
  let state = 'header';
  for (const line of lines) {
    if (line.startsWith('##AUDIT TRAIL=')) {
      state = 'skip';
      continue;
    }
    if (line.startsWith('##NTUPLES=')) state = 'ntuples';
    if (line.startsWith('##PAGE=')) state = line.includes('N=1') ? 'real' : 'skip';
    if (line.startsWith('##END NTUPLES=')) state = 'tail';
    if (line.startsWith('##END=') && state !== 'skip') state = 'tail';
    if (state === 'skip') continue;
    if (state === 'ntuples') {
      // The imaginary channel is gone, so it must leave the variable table too.
      const match = /^(##(?:VAR_NAME|SYMBOL|VAR_TYPE|VAR_FORM|VAR_DIM|UNITS|FIRST|LAST|MIN|MAX|FACTOR)=)(.*)$/.exec(
        line,
      );
      if (match) {
        const kept = match[2].split(',').slice(0, 2).join(',');
        out.push(`${match[1]}${kept}`);
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}
