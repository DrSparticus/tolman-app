import React, { useState, useRef, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { EditIcon } from '../Icons.js';
import SignatureCanvas from 'react-signature-canvas';

const usersPath = `artifacts/${process.env.REACT_APP_FIREBASE_PROJECT_ID}/users`;

// Component for inputs that defer updates until blur to prevent cursor jumping
const DeferredInput = React.memo(({ value, onBlur, ...inputProps }) => {
    const [localValue, setLocalValue] = useState(value || '');
    
    // Update local value when prop value changes
    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);
    
    const handleLocalChange = (e) => {
        setLocalValue(e.target.value);
    };
    
    const handleBlur = (e) => {
        onBlur(e);
    };
    
    return (
        <input
            {...inputProps}
            value={localValue}
            onChange={handleLocalChange}
            onBlur={handleBlur}
        />
    );
});

const ProfilePage = ({ db, user, userData, storage, appId }) => {
    const [profileData, setProfileData] = useState(userData);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const signatureRef = useRef(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);

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

    const handleSaveSignature = async () => {
        if (signatureRef.current && !signatureRef.current.isEmpty()) {
            const signatureData = signatureRef.current.toDataURL();
            const userDocRef = doc(db, usersPath, user.uid);
            await setDoc(userDocRef, { signature: signatureData }, { merge: true });
            setProfileData(prev => ({ ...prev, signature: signatureData }));
            setShowSignatureModal(false);
            alert("Signature saved!");
        } else {
            alert("Please draw your signature first");
        }
    };

    const handleClearSignature = () => {
        if (signatureRef.current) {
            signatureRef.current.clear();
        }
    };

    const handleRemoveSignature = async () => {
        if (window.confirm("Are you sure you want to remove your signature?")) {
            const userDocRef = doc(db, usersPath, user.uid);
            await setDoc(userDocRef, { signature: null }, { merge: true });
            setProfileData(prev => ({ ...prev, signature: null }));
            alert("Signature removed!");
        }
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
                        <DeferredInput type="text" name="firstName" value={profileData.firstName || ''} onBlur={handleProfileChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Last Name</label>
                        <DeferredInput type="text" name="lastName" value={profileData.lastName || ''} onBlur={handleProfileChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                </div>

                <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Signature</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        Your signature will be used when sending patch jobs for contractor approval.
                    </p>
                    {profileData.signature ? (
                        <div className="border border-gray-300 rounded-md p-4 bg-gray-50">
                            <img 
                                src={profileData.signature} 
                                alt="Your signature" 
                                className="max-h-32 mx-auto"
                            />
                            <div className="mt-4 flex gap-2 justify-center">
                                <button 
                                    onClick={() => setShowSignatureModal(true)}
                                    className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                                >
                                    Update Signature
                                </button>
                                <button 
                                    onClick={handleRemoveSignature}
                                    className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
                                >
                                    Remove Signature
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="border border-gray-300 rounded-md p-8 bg-gray-50 text-center">
                            <p className="text-gray-500 mb-4">No signature on file</p>
                            <button 
                                onClick={() => setShowSignatureModal(true)}
                                className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                            >
                                Add Signature
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-right">
                    <button onClick={handleSaveChanges} className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700">Save Changes</button>
                </div>
            </div>

            {/* Signature Modal */}
            {showSignatureModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full p-6">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Draw Your Signature</h3>
                        <div className="border-2 border-gray-300 rounded-md mb-4">
                            <SignatureCanvas
                                ref={signatureRef}
                                canvasProps={{
                                    width: 600,
                                    height: 200,
                                    className: 'signature-canvas w-full'
                                }}
                            />
                        </div>
                        <div className="flex justify-between">
                            <button
                                onClick={handleClearSignature}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                                Clear
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowSignatureModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveSignature}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Save Signature
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ProfilePage;