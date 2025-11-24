export interface User {
    id: number;
    username: string;
    gold: number;
    tokens: number;
    pity_counter: number;
}

export interface General {
    id: number;
    name: string;
    stars: number;
    str: number;
    int: number;
    ldr: number;
    luck: number;
    country: string;
    avatar: string;
    description: string;
}

export interface UserGeneral extends General {
    uid: number; // Instance ID
    level: number;
    exp: number;
    is_in_team: boolean;
}

export interface Campaign {
    id: number;
    name: string;
    req_power: number;
    gold_drop: number;
    exp_drop: number;
    passed: boolean;
    stars: number;
}

export const COUNTRY_COLORS: Record<string, string> = {
    '魏': 'bg-blue-600',
    '蜀': 'bg-green-600',
    '吴': 'bg-red-600',
    '群': 'bg-gray-600'
};
