export const roomKey = (roomId: string): string => `auction:room:${roomId}`;
export const biddersKey = (roomId: string): string =>
  `${roomKey(roomId)}:bidders`;
export const itemKey = (roomId: string, itemId: string): string =>
  `${roomKey(roomId)}:item:${itemId}`;
export const resolvedListKey = (roomId: string): string =>
  `${roomKey(roomId)}:resolved`;
export const presenceKey = (roomId: string): string =>
  `${roomKey(roomId)}:presence`;