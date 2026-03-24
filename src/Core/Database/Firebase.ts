import admin from 'firebase-admin';

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else if (process.env.NODE_ENV === 'production') {
    admin.initializeApp({
        projectId: 'media-keep-e1636'
    });
} else {
    try {
        const { readFileSync } = require('fs');
        const { join } = require('path');
        const serviceAccount = JSON.parse(
            readFileSync(join(__dirname, '../../firebase-adminsdk.json'), 'utf8')
        );
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.warn('Firebase admin SDK file not found, using default credentials');
        admin.initializeApp();
    }
}

export const firestore = admin.firestore();
export default admin;