
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { useGlobalContext } from '../context/GlobalContext';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';
import Link from '@mui/material/Link';

function ArrowIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 6l8 8-8 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect y="6" width="28" height="3.5" rx="1.5" fill="currentColor" />
      <rect y="12.25" width="28" height="3.5" rx="1.5" fill="currentColor" />
      <rect y="18.5" width="28" height="3.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export default function CollisionsSidebar() {
  const { collisions, bounds } = useGlobalContext();
  const [open, setOpen] = useState(true);

  // Only show collisions within bounds
  const filteredCollisions = bounds
    ? collisions.filter(c =>
        c.lat !== undefined && c.lon !== undefined && bounds.contains({ lat: c.lat, lng: c.lon })
      )
    : collisions;

  return (
    <>
      <IconButton
        onClick={() => setOpen(o => !o)}
        sx={{
          position: 'fixed', top: 20, right: 20, zIndex: 2200,
          bgcolor: '#ff7800', color: 'white', boxShadow: 2,
          width: 50, height: 50,
          '&:hover': { bgcolor: '#ff9800', opacity: 1, boxShadow: 4 },
        }}
      >
        {open ? <ArrowIcon /> : <MenuIcon />}
      </IconButton>
      <Drawer anchor="right" variant="persistent" open={open} sx={{ zIndex: 2000 }} slotProps={{ paper: { sx: { minWidth: 400, boxSizing: 'border-box' } } }}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" fontWeight={700} sx={{ px: 2, pt: 2 }}>Collisions</Typography>
          <Typography variant="body1" sx={{ px: 2, pb: 2 }}>Total: <b>{filteredCollisions.length}</b></Typography>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            <List sx={{ px: 2 }}>
              {filteredCollisions.map((c) => (
                <ListItem key={c.id} alignItems="flex-start" sx={{ borderBottom: '1px solid #eee' }}>
                  <ListItemAvatar sx={{ mb: 0, mt: 0 }}>
                    {c.image_url && c.wiki_url ? (
                      <a href={c.wiki_url} target="_blank" rel="noopener">
                        <img
                          src={c.image_url}
                          alt={c.common_name || c.scientific_name || 'Unknown'}
                          style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 2, marginRight: 8, background: '#eee', display: 'block' }}
                        />
                      </a>
                    ) : c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.common_name || c.scientific_name || 'Unknown'}
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 2, marginRight: 8, background: '#eee', display: 'block' }}
                      />
                    ) : null}
                  </ListItemAvatar>
                  <ListItemText
                    primary={c.common_name || c.scientific_name || 'Unknown'}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.secondary">
                          {formatCollisionTime(c.time)}
                        </Typography>
                        {c.url && (
                          <>
                            {' '}
                            <Link href={c.url} target="_blank" rel="noopener" underline="hover" color="primary">
                              Details
                            </Link>
                          </>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

function formatCollisionTime(time: string) {
  if (!time) return '';
  const d = new Date(time);
  if (isNaN(d.getTime())) return time;
  // Format: MM/DD/YY HH:mm
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear().toString().slice(-2)}`;
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear().toString().slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
