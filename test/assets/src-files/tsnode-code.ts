declare const console: any
type T2 = string['bad']

function type<T>() {
    return '';
}
const x = type<{ abc: 1 }>();
console.log(x);
