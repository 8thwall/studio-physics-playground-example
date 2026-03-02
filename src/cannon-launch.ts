import * as ecs from '@8thwall/ecs'

type QueuedEvent = {
  target: ecs.Eid;
  currentTarget: ecs.Eid;
  'name': string;
  data: any;
};

ecs.registerComponent({
  name: 'cannon-launch',
  schema: {
    // @asset
    cannonballMesh: ecs.string,
    firePower: ecs.f32,
    fireInterval: ecs.f32,
    // @label Delete Timeout (s)
    deleteTimeout: ecs.f32,
  },
  schemaDefaults: {
    fireInterval: 2.0,
    firePower: 20,
    deleteTimeout: 5,
  },
  data: {
    lastFireTime: ecs.f32,
  },
  stateMachine: ({world, eid, dataAttribute, schemaAttribute}) => {
    ecs.defineState('default')
      .initial()
      .onTick(() => {
        const {cannonballMesh, firePower, fireInterval, deleteTimeout} = schemaAttribute.get(eid)
        const currentTime = world.time.elapsed
        const {lastFireTime} = dataAttribute.get(eid)

        // Check if enough time has passed since last fire
        if (currentTime - lastFireTime >= fireInterval) {
          const cannonball = world.createEntity()

          ecs.GltfModel.set(world, cannonball, {
            url: cannonballMesh,
            collider: false,
          })

          ecs.Collider.set(world, cannonball, {
            type: ecs.ColliderType.Dynamic,
            shape: ecs.ColliderShape.Sphere,
            radius: 0.2,
            mass: 3,
          })

          world.time.setTimeout(() => {
            world.deleteEntity(cannonball)
          }, deleteTimeout * 1000)

          const mat = ecs.math.mat4.i()
          world.getWorldTransform(eid, mat)
          const {r, t} = mat.decomposeTrs()
          world.transform.setWorldPosition(cannonball, t)
          const forward = r.timesVec(ecs.math.vec3.xyz(-1, 0, 0))  // correct instance method on quat
          ecs.physics.setLinearVelocity(world, cannonball, forward.x * firePower, forward.y * firePower, forward.z * firePower)

          // Update last fire time
          dataAttribute.set(eid, {lastFireTime: currentTime})
        }
      })
  },
})
