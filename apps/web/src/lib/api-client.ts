import { api } from "./api";
import type {
  CreateRoomInput,
  ResolvedItem,
  Role,
  RoomDetail,
  RoomSummary,
} from "@auction/shared";

export interface SocketTokenResponse {
  token: string;
}

export interface ListRoomsResponse {
  rooms: RoomSummary[];
  viewerRole: Role;
}

export interface RoleResponse {
  id: string;
  activeRole: Role;
}

export interface StatsResponse {
  activeBids: number;
  wonItems: number;
  totalExposure: number;
}

export interface AuctioneerStatsResponse {
  totalBidsToday: number;
  currentValue: number;
  successRate: string;
}

export interface ResultsResponse {
  room: {
    id: string;
    title: string;
    code: string;
    status: string;
    auctioneerName: string;
    perRoomBudget: number;
    minIncrement: number;
    completedAt: string | null;
  };
  items: ResolvedItem[];
  participants: unknown[];
  winners: ResolvedItem[];
  stats: {
    totalBids: number;
    participantCount: number;
    duration: string;
  };
}

function handleError(err: unknown): never {
  const axErr = err as { response?: { data?: { error?: string } }; message?: string };
  const message = axErr?.response?.data?.error ?? axErr?.message ?? "Request failed";
  throw new Error(message);
}

export const apiClient = {
  async listRooms(): Promise<ListRoomsResponse> {
    try {
      const { data } = await api.get<ListRoomsResponse>("/api/rooms");
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getRoom(roomId: string): Promise<RoomDetail> {
    try {
      const { data } = await api.get<RoomDetail>(`/api/rooms/${roomId}`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async createRoom(input: CreateRoomInput): Promise<RoomDetail> {
    try {
      const { data } = await api.post<RoomDetail>("/api/rooms", input);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async joinRoom(roomId: string, code: string): Promise<RoomDetail> {
    try {
      const { data } = await api.post<RoomDetail>(`/api/rooms/${roomId}/join`, {
        code,
      });
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async startAuction(roomId: string): Promise<void> {
    try {
      await api.post(`/api/rooms/${roomId}/start`);
    } catch (err) {
      handleError(err);
    }
  },

  async cancelAuction(roomId: string): Promise<void> {
    try {
      await api.delete(`/api/rooms/${roomId}`);
    } catch (err) {
      handleError(err);
    }
  },

  async getResults(roomId: string): Promise<ResultsResponse> {
    try {
      const { data } = await api.get<ResultsResponse>(`/api/rooms/${roomId}/results`);
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getRole(): Promise<RoleResponse> {
    try {
      const { data } = await api.get<RoleResponse>("/api/me/role");
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async switchRole(role: Role): Promise<RoleResponse> {
    try {
      const { data } = await api.patch<RoleResponse>("/api/me/role", { role });
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getStats(): Promise<StatsResponse> {
    try {
      const { data } = await api.get<StatsResponse>("/api/me/stats");
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getAuctioneerStats(): Promise<AuctioneerStatsResponse> {
    try {
      const { data } = await api.get<AuctioneerStatsResponse>("/api/me/auctioneer-stats");
      return data;
    } catch (err) {
      handleError(err);
    }
  },

  async getSocketToken(): Promise<SocketTokenResponse> {
    try {
      const { data } = await api.get<SocketTokenResponse>("/api/auth/socket-token");
      return data;
    } catch (err) {
      handleError(err);
    }
  },
};