// Save text as a file on the device (used for backups).
// The single-file preview build swaps this module for a stub, because previews can't download files.
export function downloadText(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  return true;
}
