import type { Request } from 'express';
import type Cache from '../System/Cache';
import type { database as SQLiteDB } from '../../Core/Database/SQLite';
import type mongoose from 'mongoose';

export interface AuthUser {
    uid:     string;
    email?:  string;
    name?:   string;
    role?:   string;
    [key: string]: any;
}

export interface GraphQLContext {
    req:       Request;
    user:      AuthUser | null;
    cache:     typeof Cache;
    mongo:     typeof mongoose;
    db:        SQLiteDB | null;

}