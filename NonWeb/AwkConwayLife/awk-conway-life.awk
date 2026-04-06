# AwkConwayLife v0.1

BEGIN {
  RR=0;
  CC=0;
  FS="";
}
{
  if(NF > CC) CC=NF;
  RR=NR;
  for(j=1;j<=NF;j++) {
    if($j == "#") {
      cell[NR, j]=1;
      neighborcount[NR-1, j-1]++;
      neighborcount[NR-1, j]++;
      neighborcount[NR-1, j+1]++;
      neighborcount[NR, j-1]++;
      neighborcount[NR, j+1]++;
      neighborcount[NR+1, j-1]++;
      neighborcount[NR+1, j]++;
      neighborcount[NR+1, j+1]++;
    }
  }
}
END {
  for(i=1;i<=RR;i++) {
    nextrow="";
    for(j=1;j<=CC;j++) {
      thiscount=neighborcount[i, j];
      if(i==1) thiscount+=neighborcount[RR+1, j];
      if(j==1) thiscount+=neighborcount[i, CC+1];
      if(i==RR) thiscount+=neighborcount[0, j];
      if(j==CC) thiscount+=neighborcount[i, 0];
      if(i==1 && j==1) thiscount+=neighborcount[RR+1, CC+1];
      if(i==1 && j==CC) thiscount+=neighborcount[RR+1, 0];
      if(i==RR && j==1) thiscount+=neighborcount[0, CC+1];
      if(i==RR && j==CC) thiscount+=neighborcount[0, 0];
      if(cell[i, j]==1) {
        if(thiscount<2) nextcell=".";
        else if(thiscount<4) nextcell="#";
        else nextcell=".";
      }
      else if(thiscount==3) nextcell="#";
      else nextcell=".";
      nextrow=nextrow nextcell;
#      nextrow=nextrow " " (cell[i, j]==1 ? "#" : ".") thiscount nextcell;
    }
    print nextrow;
  }
}
