import React, { useState, useRef, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { EditIcon } from '../Icons.js';

const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;

const ProfilePage = ({ db, user, userData, storage, appId }) => {
    const [profileData, setProfileData] = useState(userData);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setProfileData(userData);
    }, [userData]);

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handlePictureUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !storage || !user) return;
        
        setIsUploading(true);
        const storageRef = ref(storage, `artifacts/${appId}/users/${user.uid}/profile-images/${file.name}`);
        
        try {
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            
            await updateProfile(user, { photoURL: downloadURL });
            
            const userDocRef = doc(db, usersPath, user.uid);
            await setDoc(userDocRef, { photoURL: downloadURL }, { merge: true });
            
            setProfileData(prev => ({ ...prev, photoURL: downloadURL }));
        } catch (error) {
            console.error("Error uploading profile picture:", error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveChanges = async () => {
        const userDocRef = doc(db, usersPath, user.uid);
        const { firstName, lastName } = profileData;
        await setDoc(userDocRef, { firstName, lastName }, { merge: true });
        alert("Profile saved!");
    };

    const userInitial = (profileData.firstName || 'U').charAt(0).toUpperCase();
    const userAvatarUrl = profileData.photoURL || `https://placehold.co/128x128/EBF4FF/76A9FA?text=${userInitial}`;

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">My Profile</h1>
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="flex items-center space-x-6">
                    <div className="relative">
                        <img 
                            src={userAvatarUrl} 
                            alt="Profile" 
                            className="w-32 h-32 rounded-full object-cover bg-gray-200" 
                            onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/128x128/EBF4FF/76A9FA?text=${userInitial}`; }}
                        />
                        <button onClick={() => fileInputRef.current.click()} className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700">
                            <EditIcon />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handlePictureUpload} className="hidden" accept="image/*" />
                        {isUploading && <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-full"><div className="text-white">Uploading...</div></div>}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{profileData.firstName} {profileData.lastName}</h2>
                        <p className="text-gray-500 capitalize">{profileData.role}</p>
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">First Name</label>
                        <input type="text" name="firstName" value={profileData.firstName || ''} onChange={handleProfileChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Last Name</label>
                        <input type="text" name="lastName" value={profileData.lastName || ''} onChange={handleProfileChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                </div>

                <div className="mt-8 text-right">
                    <button onClick={handleSaveChanges} className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700">Save Changes</button>
                </div>
            </div>
        </div>
    )
}

export default ProfilePage;