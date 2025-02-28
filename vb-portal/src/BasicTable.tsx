import * as React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Box from "@mui/material/Box";
import {Grid, useMediaQuery, useTheme} from "@mui/material";


const items = [
  {
    id: 1,
    image: "https://via.placeholder.com/50",
    title: "Product 1",
    price: "$100",
    ratio: "1.5",
    profit: "$50",
    shop: "Amazon",
    createdAt: "2025-02-28",
  },
  {
    id: 2,
    image: "https://via.placeholder.com/50",
    title: "Product 2",
    price: "$200",
    ratio: "1.8",
    profit: "$80",
    shop: "eBay",
    createdAt: "2025-02-27",
  },
  {
    id: 1,
    image: "https://via.placeholder.com/50",
    title: "Product 1",
    price: "$100",
    ratio: "1.5",
    profit: "$50",
    shop: "Amazon",
    createdAt: "2025-02-28",
  },
  {
    id: 2,
    image: "https://via.placeholder.com/50",
    title: "Product 2",
    price: "$200",
    ratio: "1.8",
    profit: "$80",
    shop: "eBay",
    createdAt: "2025-02-27",
  },
  {
    id: 1,
    image: "https://via.placeholder.com/50",
    title: "Product 1",
    price: "$100",
    ratio: "1.5",
    profit: "$50",
    shop: "Amazon",
    createdAt: "2025-02-28",
  },
  {
    id: 2,
    image: "https://via.placeholder.com/50",
    title: "Product 2",
    price: "$200",
    ratio: "1.8",
    profit: "$80",
    shop: "eBay",
    createdAt: "2025-02-27",
  },

  {
    id: 1,
    image: "https://via.placeholder.com/50",
    title: "Product 1",
    price: "$100",
    ratio: "1.5",
    profit: "$50",
    shop: "Amazon",
    createdAt: "2025-02-28",
  },
  {
    id: 2,
    image: "https://via.placeholder.com/50",
    title: "Product 2",
    price: "$200",
    ratio: "1.8",
    profit: "$80",
    shop: "eBay",
    createdAt: "2025-02-27",
  },
  {
    id: 1,
    image: "https://via.placeholder.com/50",
    title: "Product 1",
    price: "$100",
    ratio: "1.5",
    profit: "$50",
    shop: "Amazon",
    createdAt: "2025-02-28",
  },
  {
    id: 2,
    image: "https://via.placeholder.com/50",
    title: "Product 2",
    price: "$200",
    ratio: "1.8",
    profit: "$80",
    shop: "eBay",
    createdAt: "2025-02-27",
  },
];

export default function BasicTable() {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
    return (
      <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
        <Grid container spacing={2} sx={{ fontWeight: "bold", mb: 1 }}>
          <Grid item xs={3}>Title</Grid>
          <Grid item xs={1.5}>Price</Grid>
          <Grid item xs={1.5}>Ratio</Grid>
          <Grid item xs={1.5}>Profit</Grid>
          {!isSmallScreen && <Grid item xs={2}>Shop</Grid>}
          {!isSmallScreen && <Grid item xs={2.5}>Created At</Grid>}
        </Grid>

        {items.map((item) => (
          <>

          <ListItem alignItems="flex-start">
              <ListItemAvatar>
                  {/*<Avatar alt="Remy Sharp" src="/static/images/avatar/1.jpg" />*/}

                <Box
                  component="img"
                  sx={{
                    height: 233,
                    width: 350,
                    maxHeight: { xs: 233, md: 167 },
                    maxWidth: { xs: 350, md: 250 },
                  }}
                  alt="The house from the offer."
                  src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&w=350&dpr=2"
                />

              </ListItemAvatar>

            <Grid container spacing={2} alignItems="center">
              <Grid item xs={3}>
                <Typography>{item.title}</Typography>
              </Grid>
              <Grid item xs={1.5}>
                <Typography>{item.price}</Typography>
              </Grid>
              <Grid item xs={1.5}>
                <Typography>{item.ratio}</Typography>
              </Grid>
              <Grid item xs={1.5}>
                <Typography>{item.profit}</Typography>
              </Grid>
              <Grid item xs={2}>
                <Typography>{item.shop}</Typography>
              </Grid>
              <Grid item xs={2.5}>
                <Typography>{item.createdAt}</Typography>
              </Grid>
            </Grid>
          </ListItem>
          <Divider variant="inset" component="li" />
          </>
          ))}

      </List>
    );
}
