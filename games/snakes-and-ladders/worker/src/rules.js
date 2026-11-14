export const SNAKES=Object.freeze({16:6,47:26,49:11,56:53,62:19,64:60,87:24,93:73,95:75,98:78});
export const LADDERS=Object.freeze({1:38,4:14,9:31,21:42,28:84,36:44,51:67,71:91,80:100});
export function resolveRoll(position,value){
 if(!Number.isInteger(position)||position<0||position>100)throw new Error("Invalid player position.");
 if(!Number.isInteger(value)||value<1||value>6)throw new Error("Invalid dice value.");
 const raw=position+value;let to=raw<=100?raw:position,transport=null;
 if(LADDERS[to]){transport={type:"ladder",from:to,to:LADDERS[to]};to=LADDERS[to];}
 else if(SNAKES[to]){transport={type:"snake",from:to,to:SNAKES[to]};to=SNAKES[to];}
 return {from:position,raw,to,transport,overshoot:raw>100};
}
