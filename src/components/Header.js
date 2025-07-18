import React, { useState, useEffect, useRef } from 'react';
import { pages } from '../pagesConfig';
import { MenuIcon, ChevronLeftIcon } from '../Icons';
import TolmanLogo from '../TolmanConstructionLogo.png';

const Header = ({ userData, onSignOut, setCurrentPage, currentPage }) => {
    const [isMobileNavOpen, setMobileNavOpen] = useState(false);
    const trigger = useRef(null);
    const sidebar = useRef(null);

    // close on click outside
    useEffect(() => {
        const clickHandler = ({ target }) => {
            if (!sidebar.current || !trigger.current) return;
            if (!isMobileNavOpen || sidebar.current.contains(target) || trigger.current.contains(target)) return;
            setMobileNavOpen(false);
        };
        document.addEventListener('click', clickHandler);
        return () => document.removeEventListener('click', clickHandler);
    }, [isMobileNavOpen]);

    // close if the esc key is pressed
    useEffect(() => {
        const keyHandler = ({ keyCode }) => {
            if (!isMobileNavOpen || keyCode !== 27) return;
            setMobileNavOpen(false);
        };
        document.addEventListener('keydown', keyHandler);
        return () => document.removeEventListener('keydown', keyHandler);
    }, [isMobileNavOpen]);

    const hasAccess = (pageId) => {
        if (userData?.role === 'admin') return true;
        if (pageId === 'profile') return true; // All users can see their profile
        return !!userData?.permissions?.[pageId];
    };

    const navItems = pages.filter(p => !p.hidden && hasAccess(p.id));

    const NavLink = ({ page, isMobile = false }) => (
        <li>
            <button
                type="button"
                onClick={() => {
                    setCurrentPage(page.id);
                    if (isMobile) {
                        setMobileNavOpen(false);
                    }
                }}
                className={`w-full flex items-center p-2 text-gray-700 rounded-lg hover:bg-gray-100 group text-left ${
                    currentPage === page.id ? 'bg-gray-200' : ''
                }`}
            >
                {React.cloneElement(page.icon, { className: "w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900"})}
                <span className="ml-3 flex-1 whitespace-nowrap">{page.text}</span>
            </button>
        </li>
    );

    const ProfileSection = ({ isMobile = false }) => (
        <div className="p-4 border-t border-gray-200">
            <button type="button" className="w-full flex items-center text-left" onClick={() => { setCurrentPage('profile'); if(isMobile) setMobileNavOpen(false); }}>
                <img className="h-10 w-10 rounded-full object-cover" src={userData.photoURL || `https://ui-avatars.com/api/?name=${userData.firstName}+${userData.lastName}&background=random`} alt="User avatar" />
                <div className="ml-3">
                    <p className="text-sm font-semibold text-gray-800">{userData.firstName} {userData.lastName}</p>
                    <p className="text-xs text-gray-500 capitalize">{userData.role}</p>
                </div>
            </button>
            <button onClick={onSignOut} className="w-full mt-4 text-sm text-left text-red-600 hover:text-red-800 font-medium">Sign Out</button>
        </div>
    );

    const SidebarContent = ({ isMobile = false }) => (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <button type="button" onClick={() => { setCurrentPage('home'); if(isMobile) setMobileNavOpen(false); }} className="w-full">
                    <img src={TolmanLogo} alt="Tolman Construction Logo" className="w-full h-auto" />
                </button>
                {isMobile && (
                    <button onClick={() => setMobileNavOpen(false)} className="p-2 -mr-2 rounded-md text-gray-500 hover:bg-gray-100">
                        <ChevronLeftIcon />
                    </button>
                )}
            </div>
            <nav className="flex-1 p-4 overflow-y-auto">
                <ul className="space-y-1">
                    {navItems.map(page => <NavLink key={page.id} page={page} isMobile={isMobile} />)}
                </ul>
            </nav>
            <ProfileSection isMobile={isMobile} />
        </div>
    );

    return (
        <>
            {/* Mobile header */}
            <header className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="flex items-center justify-between h-16 px-4">
                    <button type="button" onClick={() => setCurrentPage('home')} className="flex items-center h-full">
                        <img src={TolmanLogo} alt="Tolman Construction Logo" className="h-10 w-auto" />
                    </button>
                    <button ref={trigger} onClick={() => setMobileNavOpen(true)} className="p-2 -mr-2 rounded-md text-gray-500 hover:bg-gray-100">
                        <MenuIcon />
                    </button>
                </div>
            </header>

            {/* Mobile sidebar (drawer) */}
            <div
                ref={sidebar}
                className={`fixed inset-0 z-40 md:hidden transform transition-transform duration-300 ease-in-out ${
                    isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="absolute inset-0 bg-gray-900/50" onClick={() => setMobileNavOpen(false)}></div>
                <div className="relative w-72 max-w-[calc(100%-4rem)] h-full bg-white shadow-lg">
                    <SidebarContent isMobile />
                </div>
            </div>

            {/* Desktop sidebar */}
            <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:flex-col w-72 bg-white border-r border-gray-200 z-20">
                <SidebarContent />
            </aside>
        </>
    );
};

export default Header;