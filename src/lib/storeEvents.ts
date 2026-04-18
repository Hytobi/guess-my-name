export const DATA_EVENT = 'guess-my-name:data'

export function notifyDataChanged(): void {
  window.dispatchEvent(new CustomEvent(DATA_EVENT))
}
