import { Search } from '@metamorph/react-native-yamap';

export function isYandexSearchAvailable() {
  return typeof Search?.searchText === 'function';
}

export function searchYandexText(
  query: string,
  figure: Parameters<typeof Search.searchText>[1],
  options: Parameters<typeof Search.searchText>[2]
) {
  return Search.searchText(query, figure, options);
}
