// src/lib/userUtils.ts
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';

// Define the shape that matches your Firestore 'users' documents
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayname: string;
  avatarUrl?: string | null;
  role?: string;
  createdAt?: any;
  updatedAt?: any;
  // Add other fields you expect in your Firestore user doc
}

/**
 * Fetch a user's profile by uid from Firestore.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as UserProfile;
    }
    return null;
  } catch (err) {
    console.error('Firestore getUserProfile failed:', err);
    return null;
  }
}

/**
 * Create (or overwrite) a user profile in Firestore.
 */
export async function createUserProfile(profileData: {
  userId: string;
  email: string;
  username: string;
  displayname: string;
  avatarUrl?: string;
}): Promise<UserProfile> {
  try {
    const { userId, ...rest } = profileData;
    const docRef = doc(db, 'users', userId);
    
    // We merge true to avoid wiping existing fields if any (though create usually implies new)
    const now = serverTimestamp();
    const newData = {
      ...rest,
      createdAt: now,
      updatedAt: now,
      role: 'reader' // Default role
    };

    await setDoc(docRef, newData, { merge: true });

    // Return what we just wrote (approximate, since serverTimestamp is pending)
    return {
      id: userId,
      ...newData,
      avatarUrl: newData.avatarUrl ?? null
    } as UserProfile;

  } catch (err) {
    console.error('Firestore createUserProfile failed:', err);
    throw err;
  }
}

/**
 * Check if a username is available by querying the 'users' collection.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const snap = await getDocs(q);
    
    return snap.empty;
  } catch (err) {
    console.error('Firestore isUsernameAvailable failed:', err);
    // Fail safe: assume not available to prevent dupes or assume available?
    // Usually safer to say FALSE if we can't check, but blocking UI is bad.
    // Let's return false to be safe.
    return false; 
  }
}
