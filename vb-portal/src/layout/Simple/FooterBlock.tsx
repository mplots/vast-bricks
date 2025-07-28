// material-ui
import { styled } from '@mui/material/styles';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// third-party
import { motion } from 'framer-motion';

// project-imports
import Logo from 'components/logo';

// assets
import { Dribbble, Youtube } from 'iconsax-reactjs';
import GithubIcon from 'assets/github';

// link - custom style
const FooterLink = styled(Link)(({ theme }) => ({
  color: theme.palette.text.primary,
  '&:hover, &:active': {
    color: theme.palette.primary.main
  }
}));

type showProps = {
  isFull?: boolean;
};

// ==============================|| LANDING - FOOTER PAGE ||============================== //

export default function FooterBlock({ isFull }: showProps) {
  const linkSX = { color: 'text.secondary', fontWeight: 400, opacity: '0.6', cursor: 'pointer', '&:hover': { opacity: '1' } };

  return (
    <>
      <Box sx={{ pt: isFull ? 5 : 10, pb: 10, bgcolor: 'secondary.200', borderColor: 'divider' }}>
        <Container>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <motion.div
                initial={{ opacity: 0, translateY: 550 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 150,
                  damping: 30
                }}
              >
                <Grid container spacing={2}>
                  <Grid size={12}>
                    <Logo to="/" />
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 400, maxWidth: 320 }}>
                      Phoenixcoded has gained the trust of over 5.5K+ customers since 2015, thanks to our commitment to delivering
                      high-quality products. Our experienced team players are responsible for managing Able Pro.
                    </Typography>
                  </Grid>
                </Grid>
              </motion.div>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Grid container spacing={{ xs: 5, md: 2 }}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Stack sx={{ gap: 3 }}>
                    <Typography variant="h5">Company</Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink href="https://1.envato.market/xk3bQd" target="_blank" underline="none">
                        Profile
                      </FooterLink>
                      <FooterLink href="https://1.envato.market/Qyre4x" target="_blank" underline="none">
                        Portfolio
                      </FooterLink>
                      <FooterLink href="https://1.envato.market/Py9k4X" target="_blank" underline="none">
                        Follow Us
                      </FooterLink>
                      <FooterLink href="https://phoenixcoded.net" target="_blank" underline="none">
                        Website
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Stack sx={{ gap: 3 }}>
                    <Typography variant="h5">Help & Support</Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink href="https://phoenixcoded.gitbook.io/able-pro" target="_blank" underline="none">
                        Documentation
                      </FooterLink>
                      <FooterLink href="https://phoenixcoded.authordesk.app/" target="_blank" underline="none">
                        Feature Request
                      </FooterLink>
                      <FooterLink href="https://phoenixcoded.gitbook.io/able-pro/v/react/roadmap/" target="_blank" underline="none">
                        RoadMap
                      </FooterLink>
                      <FooterLink href="https://phoenixcoded.authordesk.app/" target="_blank" underline="none">
                        Support
                      </FooterLink>
                      <FooterLink href="https://themeforest.net/user/phoenixcoded#contact" target="_blank" underline="none">
                        Email Us
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Stack sx={{ gap: 3 }}>
                    <Typography variant="h5">Useful Resources</Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink href="https://themeforest.net/page/item_support_policy" target="_blank" underline="none">
                        Support Policy
                      </FooterLink>
                      <FooterLink href="https://themeforest.net/licenses/standard" target="_blank" underline="none">
                        Licenses Term
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Box sx={{ py: 2.4, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'secondary.200' }}>
        <Container>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <Typography>
                © Handcrafted by Team{' '}
                <Link href="https://themeforest.net/user/phoenixcoded" target="_blank" underline="none">
                  {' '}
                  Phoenixcoded
                </Link>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                <Grid>
                  <Tooltip title="Github">
                    <Link href="https://github.com/phoenixcoded" underline="none" target="_blank" sx={linkSX}>
                      <GithubIcon size={20} />
                    </Link>
                  </Tooltip>
                </Grid>
                <Grid>
                  <Tooltip title="Dribbble">
                    <Link href="https://dribbble.com/Phoenixcoded" underline="none" target="_blank" sx={linkSX}>
                      <Dribbble variant="Bold" size={20} />
                    </Link>
                  </Tooltip>
                </Grid>
                <Grid>
                  <Tooltip title="Youtube">
                    <Link href="https://www.youtube.com/@phoenixcoded" underline="none" target="_blank" sx={linkSX}>
                      <Youtube variant="Bold" size={20} />
                    </Link>
                  </Tooltip>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}
