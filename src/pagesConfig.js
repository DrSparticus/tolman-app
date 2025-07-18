import React from 'react';
import {
    HomeIcon,
    QuoteIcon,
    ScheduleIcon,
    ChangeOrderIcon,
    MaterialsIcon,
    UsersIcon,
    CustomersIcon,
    ProjectsIcon,
    SuppliersIcon,
    AdminIcon
} from './Icons.js';

export const pages = [
    { id: 'home', icon: <HomeIcon />, text: 'Home' },
    { id: 'bids', icon: <QuoteIcon />, text: 'Bid Sheet' },
    { id: 'projects', icon: <ProjectsIcon />, text: 'Projects' },
    { id: 'schedule', icon: <ScheduleIcon />, text: 'Schedule' },
    { id: 'change-orders', icon: <ChangeOrderIcon />, text: 'Change Orders' },
    { id: 'customers', icon: <CustomersIcon />, text: 'Customers' },
    { id: 'suppliers', icon: <SuppliersIcon />, text: 'Suppliers' },
    { id: 'materials', icon: <MaterialsIcon />, text: 'Materials' },
    { id: 'users', icon: <UsersIcon />, text: 'Users' },
    { id: 'administration', icon: <AdminIcon />, text: 'Administration' },
    // Profile page is managed but not displayed in nav lists
    { id: 'profile', text: 'Profile', hidden: true },
    // Change log permission is managed but not displayed in nav lists
    { id: 'viewChangeLog', text: 'View Change Log', hidden: true },
];