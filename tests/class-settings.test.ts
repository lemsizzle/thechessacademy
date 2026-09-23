import { describe, expect, it } from 'vitest';
import { mergeRosterClasses, validateClassGroups } from '@/lib/classSettings';
const group = {id:'a',name:' Knights ',outschoolClassUrl:'https://outschool.com/classes/test',outschoolSectionId:'section-1'};
describe('class settings',()=>{
  it('preserves links and section IDs while normalizing names',()=>expect(validateClassGroups([group])[0]).toMatchObject({...group,name:'Knights',syncStatus:'linked'}));
  it('rejects ambiguous names and unsafe links',()=>{
    expect(()=>validateClassGroups([group,{...group,id:'b',name:'knights'}])).toThrow();
    expect(()=>validateClassGroups([{...group,outschoolClassUrl:'javascript:alert(1)'}])).toThrow();
    expect(()=>validateClassGroups([{...group,outschoolClassUrl:'https://outschool.com.evil.example/'}])).toThrow();
    expect(()=>validateClassGroups([{...group,name:'Unassigned'}])).toThrow();
  });
  it('imports real roster classes without losing saved links or creating duplicates',()=>{
    const groups = validateClassGroups([group]);
    const result=mergeRosterClasses(groups,['Knights','knights','Rooks','Unassigned']);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(groups[0]);
    expect(result[1].name).toBe('Rooks');
  });
});
