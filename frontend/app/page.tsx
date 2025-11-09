"use client";

import dynamic from 'next/dynamic';
const MapComponent = dynamic(() => import('../components/MapComponent'), { ssr: false });
const CollisionsSidebar = dynamic(() => import('../components/CollisionsSidebar'), { ssr: false });

export default function HomePage() {
	return (
		<div style={{position:'relative',width:'100vw',height:'100vh'}}>
			<MapComponent />
			<CollisionsSidebar />
		</div>
	);
}