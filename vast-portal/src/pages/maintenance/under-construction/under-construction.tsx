import { Link } from 'react-router-dom';

// material-ui
import Button from '@mui/material/Button';
import CardMedia from '@mui/material/CardMedia';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project-imports
import { APP_DEFAULT_PATH } from 'config';

// assets
import construction from 'assets/images/maintenance/img-cunstruct-1.svg';
import constructionBg from 'assets/images/maintenance/img-cunstruct-1-bg.png';
import constructionbottom from 'assets/images/maintenance/img-cunstruct-1-bottom.svg';

// ==============================|| UNDER CONSTRUCTION ||============================== //

export default function UnderConstruction() {
  return (
    <Box sx={{ minHeight: '100vh', backgroundImage: `url(${constructionBg})`, backgroundSize: '100%', backgroundRepeat: 'no-repeat' }}>
      <Container fixed sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Grid
          container
          spacing={3}
          sx={{
            alignItems: 'center',
            justifyContent: 'center',
            py: 2,
            backgroundImage: `url(${constructionbottom})`,
            backgroundSize: '100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'bottom'
          }}
        >
          <Grid size={{ md: 6 }}>
            <Stack sx={{ gap: 2, justifyContent: 'center', alignItems: 'center' }}>
              <Typography align="center" variant="h1">
                Under Construction
              </Typography>
              <Typography align="center" sx={{ color: 'text.secondary', width: '85%' }}>
                Hey! Please check out this site later. We are doing some maintenance on it right now.
              </Typography>
              <Button component={Link} to={APP_DEFAULT_PATH} variant="contained">
                Back To Home
              </Button>
            </Stack>
          </Grid>
          <Grid size={{ md: 6 }}>
            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ width: { xs: 300, sm: 374 } }}>
                <CardMedia component="img" src={construction} alt="under construction" sx={{ height: 1 }} />
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
