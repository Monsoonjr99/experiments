const PROJECT_VERSION = "--DEV--";

const HIVE_SIZE = 30;
const BEE_MASS = 3;
const MAX_ARMOR = 50;
const MAX_DEBRIS_SIZE = 150;
const LIGHTNING_DURATION = 30;
const DEFAULT_STEP_DURATION = 25;

var raining, tempVec, lastRender, speed, paused, dark;

function setup() {
    setVersion("Exploding Bubbles v",PROJECT_VERSION);

    createCanvas(document.body.clientWidth, document.body.clientHeight - 1);
    raining = false;
    tempVec = createVector();
    lastRender = performance.now();
    speed = 0;
    paused = false;
    dark = false;
}

function draw() {
    if(!paused){
        const tick = performance.now();
        const step_duration = DEFAULT_STEP_DURATION * Math.pow(2, -speed);
        const steps = Math.floor((tick - lastRender) / step_duration);
        for(let i = 0; i < steps; i++)
            step();
        lastRender += steps * step_duration;
    }
    if(dark)
        background(35);
    else
        background(220);
    for(let id of [Entity.types.circle, Entity.types.flare, Entity.types.hive, Entity.types.bee, Entity.types.modern_debris, Entity.types.lightning, Entity.types.dragon]){
        for(let e of Entity.query(id)){
            e.draw();
        }
    }
}

function step(){
    for(let e of Entity.forAll()){
        e.update();
    }

    Entity.prune();

    if(Entity.count(Entity.types.circle)<40 && random()<0.005) new Circle();
    if(raining){
        if(random()<0.2) new Flare(random(width),0,random(1,5),color(random(255),random(255),random(255)),PI/2,false,true);
        if(random()<0.00045) raining = false;
    }else if(random()<0.0002) raining = true;
}

class Entity{
    constructor(x, y, typeID){
        this.pos = createVector(x, y);
        this.dead = false;
        Entity.all.push(this);
        if(Entity.byType[typeID] === undefined)
            Entity.byType[typeID] = [];
        Entity.byType[typeID].push(this);
    }

    update(){

    }

    draw(){

    }

    static prune(){
        for(let i = Entity.all.length - 1; i >= 0; i--){
            if(Entity.all[i].dead)
                Entity.all.splice(i, 1);
        }
        for(let id in Entity.byType){
            for(let i = Entity.byType[id].length - 1; i >= 0; i--){
                if(Entity.byType[id][i].dead)
                    Entity.byType[id].splice(i, 1);
            }
        }
    }

    static *query(typeID){
        if(Entity.byType[typeID]){
            for(let i = 0; i < Entity.byType[typeID].length; i++){
                let e = Entity.byType[typeID][i];
                if(!e.dead)
                    yield e;
            }
        }
    }

    static *forAll(){
        for(let e of Entity.all){
            if(!e.dead)
                yield e;
        }
    }

    static count(typeID){
        if(typeID === undefined)
            return Entity.all.length;

        if(Entity.byType[typeID])
            return Entity.byType[typeID].length;

        return 0;
    }
}

Entity.all = [];
Entity.byType = {};
Entity.types = {
    circle: 0,
    flare: 1,
    hive: 2,
    bee: 3,
    modern_debris: 4,
    lightning: 5,
    dragon: 6
};

class Circle extends Entity{
    constructor(x,y){
        let m = random(8,40);
        let r = sqrt(m*100/PI);
        if(x===undefined) x = random(r,width-r);
        if(y===undefined) y = random(r,height-r);

        super(x, y, Entity.types.circle);
        this.m = m;
        this.vel = p5.Vector.random2D().mult(random(1,4));
        this.color = color(random(255),random(255),random(255));
        this.ill = false;
    }

    r(){
        return sqrt(this.m*100/PI);
    }
    
    update(){
        let p = this.pos;
        let v = this.vel;
        p.add(v);
        let m = this.m;
        let r = this.r();
        let b = 0.3;
        if(p.x-r<0) v.x += b;
        if(p.x+r>width) v.x -= b;
        if(p.y-r<0) v.y += b;
        if(p.y+r>height) v.y -= b;
        for(let that of Entity.query(Entity.types.circle)){
            if(that===this) continue;
            let d = p.dist(that.pos)-r-that.r();
            let f = pow(0.5,max(d,0))*0.6;
            tempVec.set(that.vel);
            tempVec.sub(v);
            tempVec.mult(f/m);
            v.add(tempVec);
            // v.x = lerp(v.x,that.vel.x,f);
            // v.y = lerp(v.y,that.vel.y,f);
            tempVec.set(p);
            tempVec.sub(that.pos);
            tempVec.setMag(pow(0.97,max(d,0))*0.15);
            tempVec.mult(1/m);
            v.sub(tempVec);
            if(d<0){
                tempVec.setMag(0.3/m);
                v.add(tempVec);
                if(that.m>=m && random()<0.0001){
                    that.m += m;
                    if(this.ill) that.ill = true;
                    this.dead = true;
                    return;
                }
            }
        }
        let s = r/sqrt(width*height);
        if(random()<pow(s,3.5)){
            if(m >= 10 && random()<0.2){
                new Hive(p.x,p.y,m/2,this.color,this.ill);
                this.m /= 2;
            }else{
                this.explode();
                return;
            }
        }
        for(let f of Entity.query(Entity.types.flare)){
            if(!f.dead){
                let d = p.dist(f.pos)-r;
                let g = pow(0.6,max(d,0));
                tempVec.set(f.vel);
                tempVec.setMag(max(f.vel.mag() - cos(v.angleBetween(f.vel))*v.mag(), 0)*g/m);
                v.add(tempVec);
                // v.x = lerp(v.x,f.vel.x,g);
                // v.y = lerp(v.y,f.vel.y,g);
                if(d<0 && (random()<0.03 || f.killer)){
                    this.m += f.m;
                    f.dead = true;
                    if(f.ill)
                        this.ill = true;
                    if(f.killer){
                        this.explode(true);
                        return;
                    }
                }
            }
        }
    }

    explode(hit_by_killer){
        const m = this.m;
        const p = this.pos;
        let left = m;
        if(hit_by_killer){
            for(let piece of Entity.query(Entity.types.modern_debris)){
                if(piece.pos.dist(this.pos) < this.r()){
                    let m1 = min(random(3, 10), left);
                    piece.m += m1;
                    left -= m1;
                }
            }
            if(random() < 0.01 && left > 0){
                let m1 = min(random(3, 10), left);
                new ModernDebris(p.x,p.y,m1);
                left -= m1;
            }
        }
        while(left > 0){
            let m1 = random(1,5);
            m1 = min(left, m1);
            new Flare(p.x, p.y, m1, this.color, undefined, this.ill || hit_by_killer);
            left -= m1;
        }
        this.dead = true;
    }

    draw(){
        let p = this.pos;
        let cl = this.color;
        if(this.ill){
            strokeWeight(3);
            stroke(0,150,0);
        }else stroke(cl);
        fill(red(cl),green(cl),blue(cl),50);
        ellipse(p.x,p.y,2*this.r());
        strokeWeight(1);
    }
}

class Flare extends Entity{
    constructor(x,y,m,c,a,k,r,i){
        super(x, y, Entity.types.flare);
        if(a!==undefined){
            this.vel = createVector(3);
            this.vel.rotate(a);
        }else this.vel = p5.Vector.random2D().mult(3);
        this.m = m;
        this.color = c;
        this.killer = k;
        this.rain = r;
        this.ill = i;
    }
    
    update(){
        let p = this.pos;
        let v = this.vel;
        p.add(v);
        if(p.x<0 || p.x>=width || p.y<0 || p.y>=height){
            if(random()<0.5) this.dead = true;
            else{
                if(p.x<0){
                    p.x = 0;
                    v.x *= -1;
                }else if(p.x>=width){
                    p.x = width-1;
                    v.x *= -1;
                }else if(p.y<0){
                    p.y = 0;
                    v.y *= -1;
                }else if(p.y>=height){
                    p.y = height-1;
                    v.y *= -1;
                }
            }
        }
    }

    draw(){
        let p = this.pos;
        let v = this.vel;
        let cl = this.color;
        noStroke();
        fill(red(cl),green(cl),blue(cl),50);
        tempVec.set(v).setMag(2);
        tempVec.rotate(-PI/2);
        tempVec.add(p);
        let p1x = tempVec.x;
        let p1y = tempVec.y;
        tempVec.set(v).setMag(2);
        tempVec.rotate(PI/2);
        tempVec.add(p);
        let p2x = tempVec.x;
        let p2y = tempVec.y;
        tempVec.set(v).setMag(10);
        tempVec.rotate(PI);
        tempVec.add(p);
        let p3x = tempVec.x;
        let p3y = tempVec.y;
        triangle(p1x,p1y,p2x,p2y,p3x,p3y);
        fill(cl);
        if(this.killer)
            fill(255,0,0);
        else if(this.ill)
            fill(0,150,0);
        ellipse(p.x,p.y,4);
    }
}

class Hive extends Entity{
    constructor(x,y,m,c,i,ar){
        super(x, y, Entity.types.hive);
        this.vel = createVector(random(0.5,5)).rotate(random(-PI,0));
        this.m = m;
        this.color = c;
        this.ill = i;
        this.armor = ar || 0;
    }

    update(){
        if(this.pos.y+HIVE_SIZE<height){
            this.vel.y += 0.2;
        }else{
            this.vel.y = 0;
            if(abs(this.vel.x)<0.001) this.vel.x = 0;
            else this.vel.x *= 0.95;
            if(this.pos.y+HIVE_SIZE>height) this.pos.y = lerp(this.pos.y,height-HIVE_SIZE,0.2);
        }
        if(this.pos.x<0 && this.vel.x<0 || this.pos.x+HIVE_SIZE>=width && this.vel.x>0){
            this.vel.x *= -0.9;
        }
        this.pos.add(this.vel);
        for(let f of Entity.query(Entity.types.flare)){
            if(!f.dead){
                if(f.pos.x>this.pos.x && f.pos.x<this.pos.x+HIVE_SIZE && f.pos.y>this.pos.y && f.pos.y<this.pos.y+HIVE_SIZE){
                    if(f.killer && this.armor){
                        // this.armor -= random(0.05,1);
                        // if(this.armor < 0)
                        //     this.armor = 0;
                        if(Math.random() < 0.1 * -Math.log2(this.armor / MAX_ARMOR)){
                            this.m += f.m;
                            this.explode(true);
                            f.dead = true;
                            return;
                        }else{
                            if(abs(f.pos.x - this.pos.x) > abs(f.pos.y - this.pos.y))
                                f.vel.y *= -1;
                            else
                                f.vel.x *= -1;
                            f.pos.add(f.vel);
                            f.killer = false;
                        }
                    }else{
                        this.m += f.m;
                        f.dead = true;
                        if(((f.rain && random()<0.3) || f.ill) && !this.armor)
                            this.ill = true;
                        if(f.killer){
                            this.explode(true);
                            return;
                        }
                    }
                }
            }
        }
        if(this.m>=10 && random()<(this.m<50 ? 0.005 : this.m<150 ? 0.0017 : 0.0005)){
            this.m -= BEE_MASS;
            new Bee(this.pos.x+HIVE_SIZE/2,this.pos.y+HIVE_SIZE/2,this.color,this,this.ill);
        }
        if(this.m>350 && random()<0.01){
            if(this.ill){
                this.explode(true);
                return;
            }
            let armor = 0;
            if(this.armor >= 10){
                armor = this.armor/2;
                this.armor /= 2;
            }
            new Hive(this.pos.x,this.pos.y-1,this.m/2,this.color,false,armor);
            this.m /= 2;
        }
        if(raining && this.armor && random() < 0.0002){
            Lightning.strike(this.pos.x, this.pos.y);
            return;
        }
        if(random()<0.15) this.m -= random(0.2,1);
        if(this.m<5){
            this.dead = true;
            if(this.armor)
                new ModernDebris(this.pos.x,this.pos.y,this.armor);
        }
    }

    draw(){
        let p = this.pos;
        let cl = this.color;
        if(this.ill){
            strokeWeight(3);
            stroke(0,150,0);
        }else if(this.armor){
            strokeWeight(map(this.armor,5,MAX_ARMOR,1,6,true));
            stroke(127);
        }else stroke(cl);
        fill(red(cl),green(cl),blue(cl),map(this.m,5,325,30,240,true));
        rect(p.x,p.y,HIVE_SIZE,HIVE_SIZE);
        strokeWeight(1);
    }

    explode(killer){
        if(this.armor){
            new ModernDebris(this.pos.x, this.pos.y, this.armor);
        }
        let n = 0;
        while(n<this.m){
            let l = this.m-n;
            let m1 = random(1,5);
            m1 = min(l,m1);
            new Flare(this.pos.x+HIVE_SIZE/2,this.pos.y+HIVE_SIZE/2,m1,this.color,undefined,killer);
            n += m1;
        }
        this.dead = true;
    }
}

class Bee extends Entity{
    constructor(x,y,c,h,i){
        super(x, y, Entity.types.bee);
        this.color = c;
        this.hive = h;
        this.target = undefined;
        this.ill = i;
        this.angle = 3*PI/2;
    }

    update(){
        if(!this.target){
            let candidate;
            let score = 0;
            for(let c of Entity.query(Entity.types.circle)){
                let r = c.r();
                let d = c.pos.dist(this.hive.pos)-r;
                let s = c.m*pow(0.85,d/100);
                if(s>score){
                    candidate = c;
                    score = s;
                }
            }
            if(this.hive.armor < MAX_ARMOR){
                for(let d of Entity.query(Entity.types.modern_debris)){
                    if(d.bee)
                        continue;
                    let dist = d.pos.dist(this.hive.pos)-d.r();
                    let s = 50*d.m*pow(0.85,dist/100);
                    if(s>score){
                        candidate = d;
                        score = s;
                    }
                }
            }
            if(candidate){
                this.target = candidate;
            }else{
                new Flare(this.pos.x,this.pos.y,BEE_MASS,this.color,this.angle,false,false,this.ill);
                this.dead = true;
                return;
            }
        }
        if(this.hive.dead){
            new Flare(this.pos.x,this.pos.y,BEE_MASS,this.color,this.angle,false,false,this.ill);
            this.dead = true;
            return;
        }
        if(this.target.dead){
            this.target = undefined;
            if(random()<0.2){
                tempVec.set(this.hive.pos);
                tempVec.add(HIVE_SIZE/2,HIVE_SIZE/2);
                tempVec.sub(this.pos);
                new Flare(this.pos.x,this.pos.y,BEE_MASS,this.color,tempVec.heading(),false,false,this.ill);
                this.dead = true;
            }
            return;
        }
        if(this.target instanceof ModernDebris && this.target.bee && this.target.bee !== this){
            this.target = undefined;
            return;
        }
        let carrying = false;
        if(this.target instanceof ModernDebris && this.target.bee === this)
            carrying = true;
        if(carrying){
            tempVec.set(this.hive.pos);
            tempVec.add(HIVE_SIZE/2,HIVE_SIZE/2);
            tempVec.sub(this.pos);
        }else{
            tempVec.set(this.target.pos);
            tempVec.sub(this.pos);
        }
        let a = tempVec.heading();
        this.angle = lerp(this.angle+(a-this.angle>PI ? TAU : a-this.angle<-PI ? -TAU : 0),a,0.1);
        if(this.target instanceof Circle){
            tempVec.set(this.target.pos);
            let d = tempVec.dist(this.pos)-this.target.r();
            if(abs(d)<15){
                if(this.ill)
                    this.target.ill = true;
                if(this.target.ill)
                    this.ill = true;
                if(random()<0.2){
                    let amount = random(1,4);
                    this.target.m -= amount;
                    tempVec.set(this.hive.pos);
                    tempVec.add(HIVE_SIZE/2,HIVE_SIZE/2);
                    tempVec.sub(this.pos);
                    let ang = tempVec.heading();
                    new Flare(this.pos.x,this.pos.y,amount,this.target.color,ang,false,false,this.ill);
                    if(this.target.m<1)
                        this.target.dead = true;
                }
            }
            tempVec.set(this.target.pos);
            tempVec.add(this.target.vel);
            d = tempVec.dist(this.pos)-this.target.r();
            let t = 3;
            if(d < 15)
                t = min(3, d/8);
            this.pos.add(cos(this.angle)*t,sin(this.angle)*t);
        }else if(this.target instanceof ModernDebris){
            if(carrying){
                this.pos.add(cos(this.angle)*3,sin(this.angle)*3);
                if(this.pos.x > this.hive.pos.x && this.pos.x < this.hive.pos.x+HIVE_SIZE && this.pos.y > this.hive.pos.y && this.pos.y < this.hive.pos.y+HIVE_SIZE){
                    this.hive.armor += this.target.m;
                    this.hive.ill = false;
                    this.target.dead = true;
                    this.target = undefined;
                    if(this.hive.armor > MAX_ARMOR){
                        new ModernDebris(this.hive.pos.x,this.hive.pos.y,this.hive.armor - MAX_ARMOR);
                        this.hive.armor = MAX_ARMOR;
                    }
                }
            }else{
                tempVec.set(this.target.pos);
                let d = tempVec.dist(this.pos)-this.target.r();
                if(d<10){
                    this.target.bee = this;
                    this.ill = false;
                }
                tempVec.set(this.target.pos);
                tempVec.add(this.target.vel);
                d = tempVec.dist(this.pos)-this.target.r();
                let t = 3;
                if(d < 10)
                    t = min(3, d/8);
                this.pos.add(cos(this.angle)*t,sin(this.angle)*t);
            }
        }
        for(let that of Entity.query(Entity.types.bee)){
            if(that !== this){
                tempVec.set(this.pos);
                tempVec.sub(that.pos);
                let d = tempVec.mag();
                if(d < 8 && d > 0){
                    tempVec.setMag(0.3 / d);
                    this.pos.add(tempVec);
                }
            }
        }
        if(this.ill && random()<0.005){
            new Flare(this.pos.x, this.pos.y, BEE_MASS, this.color, this.angle, false, false, true);
            this.dead = true;
        }
    }

    draw(){
        push();
        let p = this.pos;
        let cl = this.color;
        translate(p.x,p.y);
        rotate(this.angle);
        if(this.ill){
            strokeWeight(3);
            stroke(0,150,0);
        }else stroke(cl);
        fill(red(cl),green(cl),blue(cl),50);
        triangle(-15,-4,-15,4,0,0);
        pop();
    }
}

class ModernDebris extends Entity{
    constructor(x,y,m){
        super(x, y, Entity.types.modern_debris);
        this.vel = p5.Vector.random2D().mult(random(0.5,2));
        this.m = m;
        this.rot = random(0,2*PI);
        this.omega = random(-PI/64,PI/64);
        this.bee = undefined;
        this.collision_cooldown = floor(20+3*sqrt(m));
    }

    r(){
        return 5*sqrt(this.m);
    }

    update(){
        if(this.m > MAX_DEBRIS_SIZE){
            new ModernDebris(this.pos.x, this.pos.y, this.m - MAX_DEBRIS_SIZE);
            this.m = MAX_DEBRIS_SIZE;
        }
        if(random() < 0.001){
            if(this.m < 0.5){
                this.dead = true;
                return;
            }
            this.vel = p5.Vector.random2D().mult(random(0.5,2));
            this.omega = random(-PI/64,PI/64);
            if(this.m > 5 && random() < 0.1){
                let m1 = random(0.1,0.5)*this.m;
                new ModernDebris(this.pos.x,this.pos.y,m1);
                this.m -= m1;
            }
        }
        let p = this.pos;
        let v = this.vel;
        let r = this.r();
        p.add(v);
        this.rot += this.omega;
        this.rot = (this.rot % (2*PI) + 2*PI) % (2*PI);
        let r1 = (r*sqrt(3)/2)/cos(abs(PI/6 - (this.rot % (PI/3))));
        let r2 = (r*sqrt(3)/2)/cos(abs(PI/6 - ((this.rot + PI/2) % (PI/3))));
        if(p.x-r1<0){
            p.x = r1;
            v.x *= -1;
        }else if(p.x+r1>=width){
            p.x = width-1-r1;
            v.x *= -1;
        }else if(p.y-r2<0){
            p.y = r2;
            v.y *= -1;
        }else if(p.y+r2>=height){
            p.y = height-1-r2;
            v.y *= -1;
        }
        if(this.collision_cooldown)
            this.collision_cooldown--;
        else{
            for(let f of Entity.query(Entity.types.flare)){
                if(!f.dead){
                    tempVec.set(f.pos);
                    tempVec.sub(p);
                    let r3 = (r*sqrt(3)/2)/cos(abs(PI/6 - ((((tempVec.heading()-this.rot)%(2*PI)+2*PI)%(2*PI)) % (PI/3))));
                    if(tempVec.mag() < r3 && abs(tempVec.angleBetween(f.vel)) > PI/2){
                        let alpha = floor((((tempVec.heading()-this.rot)%(2*PI)+2*PI)%(2*PI))/(PI/3))*PI/3 + PI/6 + this.rot; // angle normal to side of hexagon
                        let reflect_val = -2*cos(f.vel.heading()-alpha)*f.vel.mag();
                        tempVec.set(reflect_val);
                        tempVec.rotate(alpha);
                        f.vel.add(tempVec);
                        if(f.killer){
                            f.killer = false;
                            // this.m -= random(0.05,1);
                            // if(this.m <= 0){
                            //     this.dead = true;
                            //     return;
                            // }
                        }
                        if(f.ill)
                            f.ill = false;
                    }
                }
            }
            for(let d of Entity.query(Entity.types.modern_debris)){
                if(!d.dead && d !== this && d.m+this.m <= MAX_DEBRIS_SIZE){
                    let dist = d.pos.dist(p);
                    if(dist < (r + d.r())/2 && d.m > this.m){
                        d.m += this.m;
                        this.dead = true;
                        return;
                    }
                }
            }
        }
        if(this.bee){
            if(this.bee.dead){
                this.bee = undefined;
                return;
            }
            this.pos.set(this.bee.pos);
            this.rot = this.bee.angle;
            this.pos.add(-(13+r)*cos(this.rot),-(13+r)*sin(this.rot));
        }
        if(raining && random() < 0.0002)
            Lightning.strike(this.pos.x, this.pos.y);
    }

    draw(){
        push();
        let p = this.pos;
        let r = this.r();
        translate(p.x,p.y);
        rotate(this.rot);
        noStroke();
        fill(127);
        beginShape();
        vertex(r,0);
        vertex(r*cos(PI/3),r*sin(PI/3));
        vertex(r*cos(2*PI/3),r*sin(2*PI/3));
        vertex(-r,0);
        vertex(r*cos(4*PI/3),r*sin(4*PI/3));
        vertex(r*cos(5*PI/3),r*sin(5*PI/3));
        endShape(CLOSE);
        pop();
    }
}

class Lightning extends Entity{
    constructor(x,y){
        super(x, y, Entity.types.lightning);
        this.age = 0;
        this.path = [];

        this.path.push(createVector(x, y));
        y = lerp(y, 0, random(0.2,0.7));
        for(let i = 0; i < floor(random(2,4)); i++){
            x += random(-80, 80);
            y += random(-40, -100);
            if(y <= 0)
                break;
            this.path.push(createVector(x, y));
        }
        x += random(-80, 80);
        this.path.push(createVector(x, 0));
    }

    update(){
        this.age++;
        if(this.age > LIGHTNING_DURATION)
            this.dead = true;
    }

    draw(){
        push();
        fill(255, 255, 100, 180);
        stroke(255, 255, 100, 100);
        strokeWeight(8);
        beginShape();
        vertex(this.path[0].x, this.path[0].y);
        for(let i = 1; i < this.path.length; i++)
            vertex(this.path[i].x - 5 - i*2, this.path[i].y);
        vertex(this.path[this.path.length - 1].x - 5 - (this.path.length-1)*2, -10);
        vertex(this.path[this.path.length - 1].x + 5 + (this.path.length-1)*2, -10);
        for(let i = this.path.length - 1; i >= 1; i--)
            vertex(this.path[i].x + 5 + i*2, this.path[i].y);
        endShape(CLOSE);
        pop();
    }

    static strike(x, y){
        let l = new Lightning(x, y);

        let debris_to_be_striked = [];  // as lightning strikes on modern debris spawn new modern debris, this is to avoid double-counting from looping through the array as new entities are added
        for(let d of Entity.query(Entity.types.modern_debris)){
            if(d.pos.dist(l.pos) < d.r())
                debris_to_be_striked.push(d);
        }
        for(let d of debris_to_be_striked){
            if(d.m > 5){
                let m1 = random(0.1,0.35)*d.m;
                let m2 = random(0.1,0.35)*d.m;
                new ModernDebris(d.pos.x,d.pos.y,m1);
                new ModernDebris(d.pos.x,d.pos.y,m2);
                d.m -= m1 + m2;
            }
            if(d.bee){
                d.bee.dead = true;
                d.bee = undefined;
            }
        }

        for(let h of Entity.query(Entity.types.hive)){
            if(x >= h.pos.x && x <= h.pos.x + HIVE_SIZE && y >= h.pos.y && y <= h.pos.y + HIVE_SIZE){
                if(h.armor > 0){
                    // here be dragons
                }else
                    h.explode(h.ill);
            }
        }

        for(let c of Entity.query(Entity.types.circle)){
            if(c.pos.dist(l.pos) < c.r())
                c.explode();
        }
    }
}

class Dragon extends Entity{
    constructor(x, y, c){
        super(x, y, Entity.types.dragon);
        this.rot = 3 * PI / 2;
        this.color = c;
        this.segments = [];
    }

    update(){
        
    }

    draw(){

    }
}

function mouseClicked(){
    new Circle(mouseX,mouseY);
}

function keyPressed(){
    if(key === ' '){
        paused = !paused;
        lastRender = performance.now();
    }else if(keyCode === 221){
        if(speed < 5)
            speed++;
    }else if(keyCode === 219){
        if(speed > -5)
            speed--;
    }else if(key === 'r'){
        raining = !raining;
    }else if(key === 'q'){
        new ModernDebris(mouseX, mouseY, random(10,20));
    }else if(key === 'k'){
        new Flare(mouseX, mouseY, 5, color(random(255),random(255),random(255)), undefined, true);
    }else if(key === 'h'){
        new Hive(mouseX, mouseY, random(80, 150), color(random(255),random(255),random(255)));
    }else if(key === 'x'){
        Lightning.strike(mouseX, mouseY);
    }else if(key === 'd'){
        dark = !dark;
    }
}