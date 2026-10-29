// Retained tests for the historical inventory module. Retail APIs no longer call it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {initializeInventory,units,requirements,moveStock,checkStock} from '../server/inventory.mjs';
test('historical inventory: unit precision, aggregation, balances and audit preservation',async(t)=>{
 const directory=await mkdtemp(join(tmpdir(),'arafan-history-'));
 const db=openStore(directory);t.after(async()=>{db.close();await rm(directory,{recursive:true,force:true});});
 const products=[{id:'historical-perfume'}];initializeInventory(db,products);initializeInventory(db,products);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_movements').get().n,1);
 assert.equal(units(.1),1);for(const v of [-1,.01,'10',Infinity]) assert.throws(()=>units(v));
 const items=[{productId:products[0].id,name:'History',ml:5,quantity:2},{productId:products[0].id,name:'History',ml:10,quantity:1}];
 assert.equal(requirements(items).get(products[0].id).amount,200);
 checkStock(db,items);moveStock(db,products[0].id,-200,'historical','Unit test');
 assert.equal(db.prepare('SELECT quantity_units FROM inventory').get().quantity_units,800);
 assert.throws(()=>moveStock(db,products[0].id,-801,'historical','Unit test'));
 assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory_movements').get().n,2);
});
